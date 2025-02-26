
import middy from '@middy/core';
import { APIGatewayProxyEventV2, Context, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { Logger as PowertoolsLogger } from '@aws-lambda-powertools/logger';
import { enableCorrelationIds, injectCorrelationIds } from './correlation';

describe('when both middy middlewares are applied for a handler', () => {
  // Create a dummy Lambda handler that simply returns a successful response.
  const dummyHandler = async (
    event: APIGatewayProxyEventV2,
    context: Context
  ): Promise<APIGatewayProxyStructuredResultV2> => {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Hello, world!',
        event,
      }),
    };
  };

  // We'll create a fake logger that we can spy on.
  let fakeLogger: PowertoolsLogger;

  const withMiddlewares = (
    handler?: (
      event: APIGatewayProxyEventV2,
      context: Context
    ) => Promise<APIGatewayProxyStructuredResultV2>
  ) => {
    return middy(handler).use(enableCorrelationIds())
    .before(() => {
      injectCorrelationIds(fakeLogger)
    })
  }

  beforeEach(() => {
    fakeLogger = {
      addPersistentLogAttributes: jest.fn(),
    } as unknown as PowertoolsLogger;
  });

  it('should run all middlewares and inject correlation ids into the logger', async () => {
    // Wrap the dummyHandler with your middleware chain.
    const wrappedHandler = withMiddlewares(dummyHandler);

    // Create a fake event and context.
    const fakeEvent: APIGatewayProxyEventV2 = {
      version: '2.0',
      routeKey: 'ANY /test',
      rawPath: '/test',
      rawQueryString: '',
      headers: {},
      requestContext: {} as any,
      isBase64Encoded: false,
      body: undefined,
    };

    const fakeContext: Context = {
      awsRequestId: 'test-123',
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'test-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
      memoryLimitInMB: '128',
      logGroupName: '/aws/lambda/test-function',
      logStreamName: '2020/01/01/[$LATEST]abcdef1234567890',
      done: () => {},
      fail: () => {},
      getRemainingTimeInMillis: () => 3000,
      succeed: () => {},
    };

    // Execute the wrapped handler.
    const response = await wrappedHandler(fakeEvent, fakeContext);

    // Parse the returned body.
    const parsedBody = JSON.parse(response.body ?? '{}');

    // Assert that the dummy handler ran and returned the expected message.
    expect(response.statusCode).toBe(200);
    expect(parsedBody.message).toBe('Hello, world!');
    
    // we expect that method to have been called.
    expect(fakeLogger.addPersistentLogAttributes).toHaveBeenCalledWith({
      'awsRequestId': 'test-123',
      'call-chain-length': '1',
      'x-correlation-id': 'test-123',
    });
  });

  it('should propagate errors via the error middleware', async () => {
    // Create a dummy handler that throws an error.
    const errorThrowingHandler = async () => {
      throw new Error('Test error');
    };

    const wrappedErrorHandler = withMiddlewares(errorThrowingHandler);

    const fakeEvent: APIGatewayProxyEventV2 = {
      version: '2.0',
      routeKey: 'ANY /error',
      rawPath: '/error',
      rawQueryString: '',
      headers: {},
      requestContext: {} as any,
      isBase64Encoded: false,
      body: undefined,
    };

    const fakeContext: Context = {
      awsRequestId: 'error-123',
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'error-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:error-function',
      memoryLimitInMB: '128',
      logGroupName: '/aws/lambda/error-function',
      logStreamName: '2020/01/01/[$LATEST]errorabcdef',
      done: () => {},
      fail: () => {},
      getRemainingTimeInMillis: () => 3000,
      succeed: () => {},
    };

    // We expect the wrapped handler to reject with the error.
    await expect(wrappedErrorHandler(fakeEvent, fakeContext)).rejects.toThrow('Test error');
  });
});