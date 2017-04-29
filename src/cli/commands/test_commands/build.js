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

require('colors');

const _ = require('lodash');
const { execSync } = require('child_process');
const fs = require('fs-extra');
const handlebars = require('handlebars');
const path = require('path');
const string = require('string');
const url = require('url');

const buildPacks = require('../../../build_packs');
const { error, log } = require('../../../utils');

handlebars.registerHelper('slugify', (str) => string(str).slugify().s);
handlebars.registerHelper('trim', (str) => string(str).trim().s);

const tpl = path.join(__dirname, '../../../templates/cloudbuild.yaml.tpl');

const COMMAND = `samples test build ${'[options]'.yellow}`;
const DESCRIPTION = `Launch a Cloud Container build.`;
const USAGE = `Usage:
  ${COMMAND.bold}
Description:
  ${DESCRIPTION}

  By default the build will install dependencies and run the system/unit tests.
  Passing ${'--app'.bold} will cause the build to also run the web app tests.
  Passing ${'--deploy'.bold} will cause the build to also run the web app
  deployment test.

  Pass ${'--dry-run'.bold} to see what the cloudbuild.yaml file will look like.`;

exports.command = 'build';
exports.description = DESCRIPTION;
exports.builder = (yargs) => {
  yargs
    .usage(USAGE)
    .options({
      run: {
        default: true,
        description: `${'Default:'.bold} ${`true`.yellow}. Whether to run the system/unit test command.`,
        type: 'boolean'
      },
      app: {
        description: `${'Default:'.bold} ${`false`.yellow}. Whether to run the web app test command.`,
        type: 'boolean'
      },
      deploy: {
        description: `${'Default:'.bold} ${`false`.yellow}. Whether to run the deploy command.`,
        type: 'boolean'
      },
      'builder-project': {
        alias: 'bp',
        description: `${'Default:'.bold} ${`${buildPacks.config.test.build.builderProject}`.yellow}. The project in which the Cloud Container Build should execute.`,
        requiresArg: true,
        type: 'string'
      },
      'project': {
        alias: 'p',
        description: `${'Default:'.bold} ${`${buildPacks.config.global.project}`.yellow}. The project ID to use ${'inside'.italic} the build.`,
        requiresArg: true,
        type: 'string'
      },
      'key-file': {
        alias: 'k',
        description: `${'Default:'.bold} ${`${buildPacks.config.test.build.keyFile}`.yellow}. The path to the key to copy into the build.`,
        requiresArg: true,
        type: 'string'
      },
      config: {
        description: `${'Default:'.bold} ${`${buildPacks.config.global.config}`.yellow}. Specify a JSON config file to load. Options set in the config file supercede options set at the command line.`,
        requiresArg: true,
        type: 'string'
      },
      'config-key': {
        description: `${'Default:'.bold} ${`${buildPacks.config.global.configKey}`.yellow}. Specify the key under which options are nested in the config file.`,
        requiresArg: true,
        type: 'string'
      },
      async: {
        alias: 'a',
        description: `${'Default:'.bold} ${`${buildPacks.config.test.build.async}`.yellow}. Start the build, but don't wait for it to complete.`,
        type: 'boolean'
      },
      ci: {
        description: `${'Default:'.bold} ${`${buildPacks.config.test.build.ci || false}`.yellow}. Whether this is a CI environment.`,
        type: 'boolean'
      },
      timeout: {
        description: `${'Default:'.bold} ${`${buildPacks.config.test.build.timeout}`.yellow}. The maximum time allowed for the build.`,
        requiresArg: true,
        type: 'string'
      },
      'install-cmd': {
        description: `${'Default:'.bold} ${`${buildPacks.config.test.install.cmd}`.yellow}. The install command to use.`,
        requiresArg: true,
        type: 'string'
      },
      'install-args': {
        description: `${'Default:'.bold} ${`${buildPacks.config.test.install.args.join(' ')}`.yellow}. The arguments to pass to the install command.`,
        requiresArg: true,
        type: 'string'
      },
      'web-cmd': {
        description: `${'Default:'.bold} ${`${buildPacks.config.test.app.cmd}`.yellow}. The command the web app test will use to start the app.`,
        requiresArg: true,
        type: 'string'
      },
      'web-args': {
        description: `${'Default:'.bold} ${`${buildPacks.config.test.app.args.join(' ')}`.yellow}. The arguments to pass to the command used by the web app test.`,
        requiresArg: true,
        type: 'string'
      },
      'test-cmd': {
        description: `${'Default:'.bold} ${`${buildPacks.config.test.run.cmd}`.yellow}. The system/unit test command to use.`,
        requiresArg: true,
        type: 'string'
      },
      'test-args': {
        description: `${'Default:'.bold} ${`${buildPacks.config.test.run.args.join(' ')}`.yellow}. The arguments to pass to the system/unit test command.`,
        requiresArg: true,
        type: 'string'
      }
    })
    .example('samples test build -l=~/nodejs-docs-samples/appengine/cloudsql --app --deploy');
};

exports.handler = (opts) => {
  opts.localPath = path.resolve(opts.localPath);
  const base = path.parse(opts.localPath).base;
  let configPath;
  let topConfig = {};
  let config = {};

  _.mergeWith(opts, buildPacks.config.global, (objValue, srcValue) => objValue === undefined ? srcValue : objValue);
  _.mergeWith(opts, buildPacks.config.test.build, (objValue, srcValue) => objValue === undefined ? srcValue : objValue);

  console.log(opts.run, buildPacks.config.test.build.run);

  opts.installCmd || (opts.installCmd = buildPacks.config.test.install.cmd);
  opts.installArgs || (opts.installArgs = buildPacks.config.test.install.args.join(' '));
  opts.testCmd || (opts.testCmd = buildPacks.config.test.run.cmd);
  opts.testArgs || (opts.testArgs = buildPacks.config.test.run.args.join(' '));
  opts.webCmd || (opts.webCmd = buildPacks.config.test.app.cmd);
  opts.webArgs || (opts.webArgs = buildPacks.config.test.app.args.join(' '));
  if (opts.run === undefined) {
    opts.run = buildPacks.config.test.build.run;
  }

  console.log(opts.run, buildPacks.config.test.build.run);

  // Load the config file, if any
  if (opts.config && opts.config !== 'false') {
    configPath = path.join(opts.localPath, opts.config);
    try {
      topConfig = require(configPath) || {};
      if (opts.configKey) {
        config = topConfig[opts.configKey] || {};
      } else {
        config = topConfig;
      }
    } catch (err) {
      if (err.message.includes('Cannot find')) {
        error(base, `Could not locate ${configPath}`);
      } else if (err.message.includes('JSON')) {
        error(base, `Failed to parse ${configPath}`);
      }
      error(base, err.stack || err.message);
      process.exit(1);
    }
  }

  Object.assign(opts, config);
  opts.test = config.test || config.name || topConfig.name || base;
  opts.cwd = opts.localPath;
  opts.cloudbuildYamlPath = path.join(opts.localPath, 'repo-tools-cloudbuild.yaml');

  if (opts.dryRun) {
    log(opts, 'Beginning dry run...'.cyan);
  }

  if (opts.requiresKeyFile && !opts.keyFile) {
    error(opts, `Build target requires a key file but none was provided!`);
    process.exit(1);
  } else if (opts.requiresProject && !opts.project) {
    error(opts, `Build target requires a project ID but none was provided!`);
    process.exit(1);
  }

  log(opts, `Detected build target: ${(configPath || base).yellow}`);

  opts.repoPath = getRepoPath(config.repository || topConfig.repository) || 'UNKNOWN';
  if (opts.repoPath) {
    log(opts, `Detected repository: ${opts.repoPath.magenta}`);
  }
  opts.sha = getHeadCommitSha(opts.localPath) || 'UNKNOWN';
  if (opts.sha) {
    log(opts, `Detected SHA: ${opts.sha.magenta}`);
  }
  if (opts.ci) {
    log(opts, `Detected CI: ${`${opts.ci}`.magenta}`);
  }

  try {
    // Setup key file, if any
    if (opts.keyFile && opts.requiresKeyFile) {
      opts.keyFilePath = path.resolve(opts.keyFile);
      log(opts, `Copying: ${opts.keyFilePath.yellow}`);
      opts.keyFileName = path.parse(opts.keyFilePath).base;
      opts.copiedKeyFilePath = path.join(opts.localPath, path.parse(opts.keyFilePath).base);
      if (!opts.dryRun) {
        fs.copySync(opts.keyFilePath, path.join(opts.localPath, path.parse(opts.keyFilePath).base));
      }
    }
    // Setup project ID, if any
    if (opts.project) {
      log(opts, `Setting build project ID to: ${opts.project.yellow}`);
    }

    // Generate the cloudbuild.yaml file
    log(opts, `Compiling: ${opts.cloudbuildYamlPath.yellow}`);
    const template = handlebars.compile(fs.readFileSync(tpl, 'utf8'))(opts);
    if (!opts.dryRun) {
      log(opts, `Writing: ${opts.cloudbuildYamlPath.yellow}`);
      fs.writeFileSync(opts.cloudbuildYamlPath, template);
    } else {
      log(opts, `Printing: ${opts.cloudbuildYamlPath.yellow}\n${template}`);
    }

    // Start the build
    let buildCmd = `gcloud container builds submit . --config 'repo-tools-cloudbuild.yaml' --project '${opts.builderProject}'`;
    if (opts.async) {
      buildCmd += ' --async';
    } else {
      log(opts, `Will wait for build to complete.`);
    }
    log(opts, `Build command: ${buildCmd.yellow}`);
    if (!opts.dryRun) {
      try {
        execSync(buildCmd, {
          cwd: opts.localPath,
          stdio: 'inherit',
          timeout: 20 * 60 * 1000
        });
        // Remove temp files
        cleanup(opts);
      } catch (err) {
        // Remove temp files
        cleanup();
        process.exit(err.status);
      }
    }
  } catch (err) {
    error(opts, err);
    cleanup(opts);
    throw err;
  }

  if (opts.dryRun) {
    log(opts, 'Dry run complete.'.cyan);
  }
};

function cleanup (opts) {
  try {
    fs.unlinkSync(opts.cloudbuildYamlPath);
  } catch (err) {}
  try {
    fs.unlinkSync(opts.copiedKeyFilePath);
  } catch (err) {}
}

function getRepoPath (repository) {
  repository || (repository = {});
  if (typeof repository === 'string') {
    repository = {
      url: repository
    };
  }

  if (!repository.url) {
    throw new Error('Missing repository!');
  }

  return url.parse(repository.url).path.replace('.git', '');
}

function getHeadCommitSha (cwd) {
  if (process.env.CIRCLE_SHA1) {
    return process.env.CIRCLE_SHA1;
  }
  const stdout = execSync('git log -n 1 --pretty=format:"%H"', {
    cwd,
    stdout: 'ignore',
    timeout: 20 * 60 * 1000
  });
  return stdout.toString().trim();
}
