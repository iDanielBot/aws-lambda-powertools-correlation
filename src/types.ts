export type CorrelationIds = {
  awsRequestId?: string;
  'x-correlation-id'?: string;
  'call-chain-length'?: string;
  [key: string]: string | undefined;
};
