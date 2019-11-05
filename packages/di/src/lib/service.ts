import { SymbolToken } from './provider';

export interface ServiceConfig {
  provideInRoot: boolean;
}

export function Service(serviceConfig: ServiceConfig = { provideInRoot: true }) {
  return function(provider: SymbolToken<any>) {
    provider.provideInRoot = serviceConfig.provideInRoot;
  };
}
