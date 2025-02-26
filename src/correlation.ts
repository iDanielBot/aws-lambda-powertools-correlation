import { Logger as PowertoolsLogger } from '@aws-lambda-powertools/logger';
import middy from '@middy/core';
import * as Lambda from 'aws-lambda';

import { SupportedEventTypes, SUPPORTED_MATCHERS } from './event-matchers';
import { CorrelationIds } from './types';

export type CorrelationProps = {
  awsDefaults?: boolean;
};

const inMemoryCache = new Map();

export const __testExports = {
  store: inMemoryCache,
};

const CORRELATION_KEY = '__X_POWERTOOLS_CORRELATION_IDS__';

export const enableCorrelationIds = (props?: CorrelationProps) => {  return {
    before: async (handler: middy.Request) => {
      // Clear the store before each invocation
      inMemoryCache.delete(CORRELATION_KEY);
      
      if (!props || props.awsDefaults === true) {
        const event = handler.event as SupportedEventTypes;
        const context = handler.context as Lambda.Context;

        context.clientContext
        const correlationIds = extractCorrelationIds(event);
        const isEmpty = !correlationIds || Object.keys(correlationIds).length === 0;
        const correlationIdsToUse = isEmpty ? defaultCorrelationIds(context) : increaseChainLength(correlationIds);

        inMemoryCache.set(CORRELATION_KEY, correlationIdsToUse) 
      } else {
        // no need to track default correlation ids -> initialize asyncLocalStorage with empty object
        inMemoryCache.set(CORRELATION_KEY,{
          'call-chain-length': '1',
        })
        
      }
    },
  };
};

export const injectCorrelationIds = (logger: PowertoolsLogger) => {
  logger.addPersistentLogAttributes({ ...useCorrelationIds() });
};

export const useCorrelationIds = (): CorrelationIds => {
  const store = inMemoryCache.get(CORRELATION_KEY) as CorrelationIds;
  if (!store || Object.keys(store).length === 0) {
    console.warn('No correlation ids found. You must enable correlation ids via enableCorrelationIds first');

    return {};
  }

  // return a fresh copy of the correlation ids, to prevent accidental mutations by consumers
  return JSON.parse(JSON.stringify(store));
};

const extractCorrelationIds = (event: SupportedEventTypes): CorrelationIds => {
  for (const matcher of SUPPORTED_MATCHERS) {
    if (matcher.matches(event)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return matcher.extractCorrelationIds(event as any);
    }
  }

  return {};
};

const defaultCorrelationIds = (context: Lambda.Context): CorrelationIds => ({
  awsRequestId: context.awsRequestId,
  'x-correlation-id': context.awsRequestId,
  'call-chain-length': '1',
});

const increaseChainLength = (correlationIds: CorrelationIds): CorrelationIds => {
  const chainLength = correlationIds['call-chain-length'] ?? '0';

  return {
    ...correlationIds,
    'call-chain-length': (Number.parseInt(chainLength) + 1).toString(),
  };
};
