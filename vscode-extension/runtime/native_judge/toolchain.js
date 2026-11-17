'use strict';
const {AsyncLocalStorage}=require('node:async_hooks');
const storage=new AsyncLocalStorage();
module.exports={withToolchain:(tools,fn)=>storage.run(tools,fn),configuredCommand:name=>storage.getStore()?.[name]};
