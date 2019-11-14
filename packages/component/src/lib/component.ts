import { Injector, ClassProviderToken } from '@lit-kit/di';
import { render, html } from 'lit-html';

import { State } from './state';
import { ElRefToken } from './el-ref';
import { ROOT_INJECTOR } from './app';
import { Metadata, getMetadataRef, ComponentConfig } from './metadata';
import {
  OnPropChanges,
  OnInit,
  OnConnected,
  OnDisconnected,
  OnAttributeChanged
} from './lifecycle';

export type ComponentInstance<T> = T &
  Partial<OnPropChanges> &
  Partial<OnInit> &
  Partial<OnConnected> &
  Partial<OnDisconnected> &
  Partial<OnAttributeChanged> & { [key: string]: any };

export type ElementInstance<C, S> = {
  componentInjector: Injector;
  componentInstance: ComponentInstance<C>;
  componentMetaData: Metadata<S>;
  componentState: State<S>;
  [key: string]: any;
} & HTMLElement;

const mapComponentProperties = <T>(
  metadata: Metadata<T>,
  el: ElementInstance<any, T>,
  instance: ComponentInstance<any>
) => {
  const length = metadata.props.length;

  for (let i = 0; i < length; i++) {
    const prop = metadata.props[i];

    Object.defineProperty(el, prop, {
      set: newValue => {
        const oldValue = instance[prop];

        instance[prop] = newValue;

        if (instance.onPropChanges) {
          instance.onPropChanges(prop, oldValue, newValue);
        }
      },
      get: () => instance[prop]
    });
  }
};

export const Component = <T = any>(config: ComponentConfig<T>) => (
  componentDef: ClassProviderToken<any>
) => {
  // add component config to metadata
  const componentMetaData = getMetadataRef<T>(componentDef);
  componentMetaData.config = config;

  customElements.define(
    config.tag,
    class extends HTMLElement implements ElementInstance<typeof componentDef, T> {
      static observedAttributes = config.observedAttributes;

      public componentInstance: ComponentInstance<typeof componentDef>;
      public componentState: State<T>;
      public componentMetaData = componentMetaData;
      public componentInjector = new Injector(
        {
          providers: [
            { provide: ElRefToken, useFactory: () => this, deps: [] },
            { provide: State, useFactory: () => new State(config.defaultState), deps: [] }
          ]
        },
        ROOT_INJECTOR
      );

      constructor() {
        super();

        const run = (eventName: string, payload: unknown) => (e: Event) => {
          if (eventName in this.componentMetaData.handlers) {
            this.componentMetaData.handlers[eventName].call(this.componentInstance, e, payload);
          }
        };

        const componentRender = (state: T) => {
          render(
            html`
              ${config.style} ${config.template(state, run)}
            `,
            shadow
          );
        };

        const shadow = this.attachShadow({ mode: 'open' });

        componentRender(config.defaultState);

        this.componentInstance = this.componentInjector.create(componentDef);
        this.componentState = this.componentInjector.get(State);

        this.componentState.onChange(state => {
          componentRender(state);
        });

        // Define setters and getters to map custom element properties to component properties
        mapComponentProperties(componentMetaData, this, this.componentInstance);

        if (this.componentInstance.onInit) {
          this.componentInstance.onInit();
        }
      }

      connectedCallback() {
        if (this.componentInstance.connectedCallback) {
          this.componentInstance.connectedCallback();
        }
      }

      disconnectedCallback() {
        if (this.componentInstance.disconnectedCallback) {
          this.componentInstance.disconnectedCallback();
        }
      }

      attributeChangedCallback(attrName: string, oldVal: string, newVal: string) {
        if (this.componentInstance.attributeChangedCallback) {
          this.componentInstance.attributeChangedCallback(attrName, oldVal, newVal);
        }
      }
    }
  );
};
