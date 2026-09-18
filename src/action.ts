import actionsCore from '@actions/core';
import * as yaml from '@std/yaml'

const customTextInput = actionsCore.getInput('custom-text-input');
const customListInput = yaml.parse(actionsCore.getInput('custom-list-input'));
const customKeyValueInput = yaml.parse(actionsCore.getInput('custom-key-value-input'));

console.log('custom-text-input:', customTextInput);
console.log('custom-list-input:', customListInput);
console.log('custom-key-value-input:', customKeyValueInput);

actionsCore.setOutput('custom-text-output', 'Test123');
