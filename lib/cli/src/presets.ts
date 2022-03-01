/* eslint-disable @typescript-eslint/ban-ts-comment */
import path from 'path';
import dedent from 'ts-dedent';
import { writeFile, existsSync } from 'fs-extra';
import { loadAllPresets, loadPreviewOrConfigFile } from '@storybook/core-common';
import { logger } from '@storybook/node-logger';

export const getAllPresets = async (configDir: string) => {
  const dummyData = {
    // @ts-ignore
    frameworkPresets: [],
    // @ts-ignore
    corePresets: [],
    // @ts-ignore
    overridePresets: [],
    framework: 'react',
    ignorePreview: false,
    // @ts-ignore
    cache: undefined,
    docsMode: false,
    packageJson: {
      name: 'test',
      version: '1.0.0',
    },
  };

  const presets = loadAllPresets({
    configDir,
    ...dummyData,
  });

  const configs = [
    // load addon presets
    ...(await presets.apply('config', [], { configDir })),
    // load preview.js
    loadPreviewOrConfigFile({ configDir }),
  ].map((configPath) => path.relative(configDir, configPath));

  return configs;
};

export async function generatePresetsFile(configDir = '.storybook') {
  try {
    logger.info(`=> Generating preset annotations file`);
    const presets = await getAllPresets(configDir);

    const targetPath = path.join(configDir, 'annotations.js');

    if (existsSync(targetPath)) {
      logger.warn('=> File already exists! Should we override it?');
      process.exit(1);
    }

    const getPresetName = (preset: string) => {
      const firstChar = preset.indexOf('node_modules/') + 'node_modules/'.length;
      const lastChar = preset.indexOf('/dist');

      const addonName = preset
        .substring(firstChar, lastChar)
        .replace('@storybook/', '')
        .replace('-', '')
        .replace('.ts', '')
        .replace('.js', '');

      return `${addonName}Config`;
    };

    const presetNames: string[] = [];
    const presetImports: string[] = [];

    presets.forEach((preset) => {
      const presetName = getPresetName(preset);
      const duplicatesCount = presetNames.filter((p) => p === presetName).length;
      const finalName = `${presetName}${duplicatesCount ? duplicatesCount + 1 : ''}`;

      presetNames.push(finalName);
      presetImports.push(`import ${finalName} from "${preset}";\n`);
    });

    const content = dedent`
      import { composeAnnotations } from '@storybook/preview-web';
      ${presetImports.join('')}
      export default composeAnnotations([${presetNames.join(', ')}]);
    `;

    logger.info(`=> Wrote file to ${targetPath}`);
    await writeFile(targetPath, content);
  } catch (error) {
    throw new Error(`Failed to generate presets file :( ${error.message}`);
  }
}
