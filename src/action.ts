import * as actionsCore from '@actions/core';
import { decodePNG } from '@img/png'

const pathInput = actionsCore.getInput('path');
const versionInput = actionsCore.getInput('version');

console.log('path:', pathInput);
console.log('version:', versionInput);
