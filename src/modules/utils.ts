import express from  'express';

const Log = (...args: any[]) => {
  console.log(`   ▸`, ...args);
}

const SCOPE: {
  __dirname: string,
  COMPONENT_ROOT: string | undefined,
  app: express.Application | undefined,
} = {
  __dirname: "",
  COMPONENT_ROOT: undefined,
  app: undefined,
}

export {
  Log,
  SCOPE
}
