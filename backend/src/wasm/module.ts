// WASM module for weave

export async function loadWASMModule(modulePath: string) {
  const response = await fetch(modulePath);
  const bytes = await response.arrayBuffer();
  const module = await WebAssembly.instantiate(bytes);
  return module.instance;
}

export async function runWASMFunction(instance: any, functionName: string, ...args: any[]) {
  if (instance.exports[functionName]) {
    return instance.exports[functionName](...args);
  }
  throw new Error(`Function ${functionName} not found in WASM module`);
}

export class WASMProcessor {
  private instance: any;

  constructor(instance: any) {
    this.instance = instance;
  }

  async process(data: any): Promise<any> {
    if (this.instance.exports.process) {
      return this.instance.exports.process(JSON.stringify(data));
    }
    throw new Error('Process function not found');
  }

  async transform(input: string): Promise<string> {
    if (this.instance.exports.transform) {
      return this.instance.exports.transform(input);
    }
    throw new Error('Transform function not found');
  }

  async compute(input: number[]): Promise<number> {
    if (this.instance.exports.compute) {
      return this.instance.exports.compute(input);
    }
    throw new Error('Compute function not found');
  }
}

export async function createWASMProcessor(modulePath: string): Promise<WASMProcessor> {
  const instance = await loadWASMModule(modulePath);
  return new WASMProcessor(instance);
}
