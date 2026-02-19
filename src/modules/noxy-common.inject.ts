export type NoxyModuleConstructor = new (...args: any[]) => any;
/** Module with a static create(); accepts any options so classes with private constructors and specific option types are assignable. */
export type NoxyModuleFactory = { create: (options: any) => any };

export interface NoxyInjectedModuleConfig<TOptions extends object = object> {
  module: NoxyModuleFactory;
  selectOptions: (options: TOptions) => unknown;
  propertyKey: string;
}

const INJECTED_MODULES_KEY = Symbol('noxy:injectedModules');

function getPropertyKey(module: NoxyModuleFactory): string {
  const name = (module as { name?: string }).name;
  return typeof name === 'string' && name ? name : 'NoxyModule';
}

export function NoxyInjectModule<TOptions extends object = object>(
  module: NoxyModuleFactory,
  selectOptions: (options: TOptions) => unknown
): ClassDecorator {
  return (target) => {
    const Base = target as unknown as NoxyModuleConstructor;
    const propertyKey = getPropertyKey(module);

    const Decorated = class extends Base {
      constructor(...args: any[]) {
        super(...args);
        const options = (args[0] ?? {}) as TOptions;
        const moduleOptions = selectOptions(options);
        const result = module.create(moduleOptions);
        const promise = Promise.resolve(result).then((instance) => {
          (this as Record<string, unknown>)[propertyKey] = instance;
          return instance;
        });
        (this as Record<string, unknown>)[`__init_${propertyKey}`] = promise;
        const existing = (this as any).__initAllModules;
        (this as any).__initAllModules = existing ? Promise.all([existing, promise]) : promise;
      }
    };

    Object.defineProperty(Decorated, 'name', { value: Base.name, writable: false });

    const existing: NoxyInjectedModuleConfig[] = (Base as any)[INJECTED_MODULES_KEY] ?? [];
    (Decorated as any)[INJECTED_MODULES_KEY] = [...existing, { module, selectOptions, propertyKey }];

    return Decorated as any;
  };
}

export function getInjectedModules(target: NoxyModuleConstructor): NoxyInjectedModuleConfig[] {
  return (target as any)[INJECTED_MODULES_KEY] ?? [];
}
