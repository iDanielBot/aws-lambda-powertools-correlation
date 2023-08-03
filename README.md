# aws-lambda-powertools-correlation
Correlation Ids for aws-lambda-powertools


<h3>Features</h3>

1. Middleware to enable injecting correlation ids from the request into the <i>AsyncLocalStorage</i>
```typescript
import { enableCorrelationIds } from '@aws-lambda-powertools-correlation';
import middy from '@middy/core';
import * as Lambda from 'aws-lambda';

export const handler = (_handler: Lambda.APIGatewayProxyHandlerV2) => {
  return middy(_handler).use(enableCorrelationIds());
};
```


2.  Utility to extend the powertools logger with correlation ids: <i>injectCorrelationIds(logger)</i>

```typescript
import { injectCorrelationIds } from '@aws-lambda-powertools-correlation';
import { Logger } from '@aws-lambda-powertools/logger'

const logger = new Logger();

export const handler = (_handler: Lambda.APIGatewayProxyHandlerV2) => {
  return middy(_handler)
      .use(enableCorrelationIds())
      .before(() => { injectCorrelationIds(logger) });
};
```

3.  Utility to get correlation ids from the AsyncLocalStorage: <i>getCorrelationIds()</i>
```typescript
import { useCorrelationIds } from '@aws-lambda-powertools-correlation';

const correlationIds = useCorrelationIds();

```
 
<h3>Dependencies</h3>

- @aws-sdk/util-dynamodb
- @aws-lambda-powertools/logger


