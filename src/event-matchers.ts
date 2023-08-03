import { unmarshall } from '@aws-sdk/util-dynamodb';
import * as Lambda from 'aws-lambda';

import { CorrelationIds } from './types';

export type SupportedEventTypes =
  | DirectInvokeEvent
  | Lambda.APIGatewayProxyEvent
  | Lambda.APIGatewayProxyEventV2
  | Lambda.DynamoDBStreamEvent
  | Lambda.EventBridgeEvent<string, unknown>
  | Lambda.SNSEvent
  | Lambda.SQSEvent;

type EventMatcher<T> = {
  matches: (event: SupportedEventTypes) => boolean;
  extractCorrelationIds: (event: T) => CorrelationIds;
};

type DirectInvokeEvent = {
  __context__: { [name: string]: string | undefined };
};

const HEADER_KEYS = ['awsRequestId', 'x-correlation-id', 'call-chain-length'];

const DirectInvokeEventMatcher: EventMatcher<DirectInvokeEvent> = {
  matches: (event: SupportedEventTypes): event is DirectInvokeEvent => {
    return event && '__context__' in event;
  },

  extractCorrelationIds: (event: DirectInvokeEvent): CorrelationIds => {
    return pickCorrelationIds(event['__context__']);
  },
};

const ApiGwV1EventMatcher: EventMatcher<Lambda.APIGatewayProxyEvent> = {
  matches: (event: SupportedEventTypes): event is Lambda.APIGatewayProxyEvent => {
    return event && 'httpMethod' in event && 'headers' in event && 'path' in event;
  },

  extractCorrelationIds: (event: Lambda.APIGatewayProxyEvent): CorrelationIds => {
    return pickCorrelationIds(event.headers);
  },
};

const ApiGwV2EventMatcher: EventMatcher<Lambda.APIGatewayProxyEventV2> = {
  matches: (event: SupportedEventTypes): event is Lambda.APIGatewayProxyEventV2 => {
    return event && 'requestContext' in event && 'headers' in event && 'http' in event.requestContext;
  },

  extractCorrelationIds: (event: Lambda.APIGatewayProxyEventV2): CorrelationIds => {
    return pickCorrelationIds(event.headers);
  },
};

const DynamoDBEventMatcher: EventMatcher<Lambda.DynamoDBStreamEvent> = {
  matches: (event: SupportedEventTypes): event is Lambda.DynamoDBStreamEvent => {
    return event && 'Records' in event && event.Records.length > 0 && 'dynamodb' in event.Records[0];
  },

  extractCorrelationIds: (event: Lambda.DynamoDBStreamEvent): CorrelationIds => {
    const recordWithCorrelation = event.Records.find((record) => !!record.dynamodb?.OldImage?.['__context__']);
    if (!recordWithCorrelation || !recordWithCorrelation.dynamodb) return {};

    const dbItem = unmarshall(recordWithCorrelation.dynamodb.OldImage as any);

    return pickCorrelationIds(dbItem['__context__']);
  },
};

const EventBridgeEventMatcher: EventMatcher<Lambda.EventBridgeEvent<string, unknown>> = {
  matches: (event: SupportedEventTypes): event is Lambda.EventBridgeEvent<string, unknown> => {
    return event && 'source' in event && 'detail-type' in event;
  },

  extractCorrelationIds: (event: Lambda.EventBridgeEvent<string, unknown>): CorrelationIds => {
    if (
      event.detail &&
      typeof event.detail === 'object' &&
      '__context__' in event.detail &&
      typeof event.detail['__context__'] === 'object'
    ) {
      return pickCorrelationIds(event.detail['__context__'] as { [name: string]: string | undefined });
    }

    return {};
  },
};

const SQSEventMatcher: EventMatcher<Lambda.SQSEvent> = {
  matches: (event: SupportedEventTypes): event is Lambda.SQSEvent => {
    return event && 'Records' in event && event.Records.length > 0 && 'messageId' in event.Records[0];
  },

  extractCorrelationIds: (event: Lambda.SQSEvent): CorrelationIds => {
    const msgAttributes = event.Records[0].messageAttributes;

    const correlationIds: CorrelationIds = {};
    for (const key of HEADER_KEYS) {
      if (msgAttributes?.[key]) {
        correlationIds[key] = msgAttributes?.[key].stringValue;
      }
    }

    return correlationIds;
  },
};

const SNSEventMatcher: EventMatcher<Lambda.SNSEvent> = {
  matches: (event: SupportedEventTypes): event is Lambda.SNSEvent => {
    return event && 'Records' in event && event.Records.length > 0 && 'Sns' in event.Records[0];
  },

  extractCorrelationIds: (event: Lambda.SNSEvent): CorrelationIds => {
    const msgAttributes = event.Records[0].Sns.MessageAttributes;

    const correlationIds: CorrelationIds = {};
    for (const key of HEADER_KEYS) {
      if (msgAttributes?.[key]) {
        correlationIds[key] = msgAttributes?.[key].Value;
      }
    }

    return correlationIds;
  },
};

const pickCorrelationIds = (headers: { [name: string]: string | undefined }) => {
  if (!headers || typeof headers !== 'object') return {};

  const correlationIds: CorrelationIds = {};
  for (const key of HEADER_KEYS) {
    if (headers?.[key]) {
      correlationIds[key] = headers?.[key];
    }
  }

  return correlationIds;
};

export const SUPPORTED_MATCHERS = [
  DirectInvokeEventMatcher,
  ApiGwV1EventMatcher,
  ApiGwV2EventMatcher,
  DynamoDBEventMatcher,
  EventBridgeEventMatcher,
  SQSEventMatcher,
  SNSEventMatcher,
];
