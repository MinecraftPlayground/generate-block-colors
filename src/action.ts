import * as actionsCore from '@actions/core';

const pathInput = actionsCore.getInput('path');

console.log('path:', pathInput);

