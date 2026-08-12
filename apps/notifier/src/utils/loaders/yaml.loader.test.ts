import { afterEach, describe, expect, it } from 'vitest';
import {
  createTempDir,
  removeTempDir,
  writeTempFile,
} from '../../../test/helpers/temp-dir';
import { loadYamlWithEnv } from './yaml.loader';

describe('loadYamlWithEnv', () => {
  let dir: string;

  afterEach(async () => {
    if (dir) {
      await removeTempDir(dir);
    }
    delete process.env.YAML_TEST_VAR;
    delete process.env.YAML_EMPTY;
  });

  it('substitutes required env vars', async () => {
    dir = await createTempDir();
    process.env.YAML_TEST_VAR = 'secret';
    const file = await writeTempFile(
      dir,
      'config.yaml',
      'value: ${YAML_TEST_VAR}\n',
    );
    expect(loadYamlWithEnv(file)).toEqual({ value: 'secret' });
  });

  it('uses default values when the env var is unset or empty', async () => {
    dir = await createTempDir();
    const file = await writeTempFile(
      dir,
      'config.yaml',
      'value: ${YAML_MISSING:-fallback}\nempty: ${YAML_EMPTY:-other}\n',
    );
    process.env.YAML_EMPTY = '';
    expect(loadYamlWithEnv(file)).toEqual({
      value: 'fallback',
      empty: 'other',
    });
  });

  it('throws when a required env var is missing', async () => {
    dir = await createTempDir();
    const file = await writeTempFile(
      dir,
      'config.yaml',
      'value: ${YAML_REQUIRED}\n',
    );
    expect(() => loadYamlWithEnv(file)).toThrow(/YAML_REQUIRED is not set/);
  });

  it('substitutes nested objects and arrays', async () => {
    dir = await createTempDir();
    process.env.YAML_TEST_VAR = 'nested';
    const file = await writeTempFile(
      dir,
      'config.yaml',
      'items:\n  - ${YAML_TEST_VAR}\nobj:\n  inner: ${YAML_TEST_VAR}\n',
    );
    expect(loadYamlWithEnv(file)).toEqual({
      items: ['nested'],
      obj: { inner: 'nested' },
    });
  });

  it('throws when the file is missing', () => {
    expect(() => loadYamlWithEnv('/tmp/does-not-exist.yaml')).toThrow(
      /Config file not found/,
    );
  });

  it('throws when YAML is empty', async () => {
    dir = await createTempDir();
    const file = await writeTempFile(dir, 'empty.yaml', '');
    expect(() => loadYamlWithEnv(file)).toThrow(/Failed to parse YAML file/);
  });
});
