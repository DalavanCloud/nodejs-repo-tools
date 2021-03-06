/**
 * Copyright 2017, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const path = require('path');
const test = require('ava');

const toolsPath = path.join(__dirname, '../../');
const utils = require(toolsPath).utils;

test.serial('parseArgs: should parse args', t => {
  t.deepEqual(utils.parseArgs(`foo`), [`foo`]);
  t.deepEqual(utils.parseArgs(`foo bar`), [`foo`, `bar`]);
  t.deepEqual(utils.parseArgs(`"foo" 'bar'`), [`"foo"`, `'bar'`]);
  t.deepEqual(utils.parseArgs(`fo'oba'r`), [`fo'oba'r`]);
  t.deepEqual(utils.parseArgs(`install --prod`), [`install`, `--prod`]);
  t.deepEqual(utils.parseArgs(`some cmd --foo='bar' -b h"ell"o`), [
    `some`,
    `cmd`,
    `--foo='bar'`,
    `-b`,
    `h"ell"o`,
  ]);
  t.throws(() => utils.parseArgs(`some cmd --foo='bar`));
});
