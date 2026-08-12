import * as fs from 'fs';
import yaml from 'js-yaml';

function substituteEnvVars(value: string): string {
  const pattern = /\$\{([^}]+)\}/g;
  let result = '';
  let lastIndex = 0;

  for (const match of value.matchAll(pattern)) {
    result += value.slice(lastIndex, match.index);

    const expression = match[1];
    const separatorIndex = expression.indexOf(':-');
    const varName =
      separatorIndex === -1 ? expression : expression.slice(0, separatorIndex);
    const hasDefault = separatorIndex !== -1;
    const defaultValue = hasDefault ? expression.slice(separatorIndex + 2) : '';
    const envValue = process.env[varName];

    if (envValue !== undefined && envValue !== '') {
      result += envValue;
    } else if (hasDefault) {
      result += defaultValue;
    } else {
      throw new Error(
        `Environment variable ${varName} is not set (or is empty) and no default value provided`,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  result += value.slice(lastIndex);
  return result;
}

function processObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return substituteEnvVars(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => processObject(item));
  }

  if (obj !== null && typeof obj === 'object') {
    const processed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      processed[key] = processObject(value);
    }
    return processed;
  }

  return obj;
}

export function loadYamlWithEnv(filePath: string): unknown {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(fileContent);

  if (!parsed) {
    throw new Error(`Failed to parse YAML file: ${filePath}`);
  }

  return processObject(parsed);
}
