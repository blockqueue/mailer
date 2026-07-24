import * as fs from 'fs';
import yaml from 'js-yaml';

/** Replace ${VAR} / ${VAR:-default} placeholders (shell-style) */
function substituteEnvVars(value: string): string {
  return value.replace(
    /\$\{([^}:-]+)(:-([^}]*))?\}/g,
    (match, varName: string, _: string, defaultValue: string | undefined) => {
      const envValue = process.env[varName];
      // Prefer non-empty env; else default; else error (shell ${VAR:-default})
      if (envValue !== undefined && envValue !== '') {
        return envValue;
      }
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(
        `Environment variable ${varName} is not set (or is empty) and no default value provided`,
      );
    },
  );
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

/** Load YAML with environment variable substitution */
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
