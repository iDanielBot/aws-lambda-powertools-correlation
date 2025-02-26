
import { Logger as PowertoolsLogger } from '@aws-lambda-powertools/logger';
import { Context } from 'aws-lambda';
import { 
  enableCorrelationIds, 
  injectCorrelationIds, 
  useCorrelationIds 
} from './correlation'; // adjust the import path accordingly

// For testing, we need access to the AsyncLocalStorage instance. 
// If it's not exported in your module, consider exporting it conditionally for tests.
// For this example, we'll assume you exported it as "asyncLocalStorage".
import { __testExports } from './correlation';

const CORRELATION_KEY = '__X_POWERTOOLS_CORRELATION_IDS__';

describe('Correlation Middleware', () => {
  describe('enableCorrelationIds', () => {
    it('should set default correlation ids when none are extracted (awsDefaults true)', () => {
      // Arrange: simulate a handler with an empty event (so extractCorrelationIds returns {})
      const fakeEvent = {}; // an event that does not match any supported matcher
      const fakeContext = { awsRequestId: '123' } as Context;
      const fakeHandler = {
        event: fakeEvent,
        context: fakeContext,
      } as any;

      // Act: Run the middleware before hook
      const middleware = enableCorrelationIds();
      middleware.before(fakeHandler);

      const store = __testExports.store
      expect(store.get(CORRELATION_KEY)).toBeDefined();
      expect(store.get(CORRELATION_KEY)).toEqual({
        awsRequestId: '123',
        'x-correlation-id': '123',
        'call-chain-length': '1',
      });
    
    });

    it('should initialize minimal correlation ids when awsDefaults is false', () => {
      const fakeEvent = { some: 'value' } as any;
      const fakeContext = { awsRequestId: '456' } as Context;
      const fakeHandler = {
        event: fakeEvent,
        context: fakeContext,
      } as any;

      const middleware = enableCorrelationIds({ awsDefaults: false });
      middleware.before(fakeHandler)
        const store = __testExports.store
        expect(store.get(CORRELATION_KEY)).toBeDefined();
        expect(store.get(CORRELATION_KEY)).toEqual({
          'call-chain-length': '1',
        });
    
    });
  });

  describe('injectCorrelationIds', () => {
    it('should add persistent log attributes to the logger using the current store', () => {
      // Arrange: initialize a test store with known correlation ids
      const store = __testExports.store
      store.set(CORRELATION_KEY, { testKey: 'testValue' })

      // Create a fake logger with a spy on addPersistentLogAttributes
      const fakeLogger = {
        addPersistentLogAttributes: jest.fn(),
      } as unknown as PowertoolsLogger;

      
      injectCorrelationIds(fakeLogger);

      // Assert: the logger's persistent log attributes should match our test store
      expect(fakeLogger.addPersistentLogAttributes).toHaveBeenCalledWith({ testKey: 'testValue' });
    });
  });

  describe('useCorrelationIds', () => {
    it('should return the correlation ids from the current store', () => {
      // Arrange: define a store with some correlation ids
      const store = __testExports.store
      store.set(CORRELATION_KEY, {key1: 'value1' })

      const ids = useCorrelationIds();
      // Assert: we expect to retrieve the same correlation ids
      expect(ids).toEqual({ key1: 'value1' });
    });

    it('should warn and return an empty object if no store is found', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const store = __testExports.store
      store.delete(CORRELATION_KEY)

      // Act: Call useCorrelationIds outside of any asyncLocalStorage context
      const ids = useCorrelationIds();

      // Assert: It should warn and return an empty object
      expect(ids).toEqual({});
      expect(warnSpy).toHaveBeenCalledWith('No correlation ids found. You must enable correlation ids via enableCorrelationIds first');

      warnSpy.mockRestore();
    });
  });
});