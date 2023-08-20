import { Code, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { join } from 'path';
import { StackContext } from 'sst/constructs';
import { request as github } from '@octokit/request';
import axios from 'axios';
import { createWriteStream } from 'fs';
import { finished } from 'stream/promises';

async function getLatestChromium() {
  console.log('Fetching latest release of chromium');
  const releases = await github('GET /repos/{owner}/{repo}/releases', {
    owner: 'Sparticuz',
    repo: 'chromium',
  });
  const latestRelease = releases.data[0];
  console.log('Latest release of chromium is ' + latestRelease.name);
  const latestReleaseZip = latestRelease.assets.filter(
    v => v.name === `chromium-${latestRelease.name}-layer.zip`
  )[0];
  console.log('downloading Zip');
  await downloadFile(
    latestReleaseZip.browser_download_url,
    join('layers', 'chromium', latestReleaseZip.name)
  );
  console.log(
    'successfully downloaded zip to ' + join('layers', 'chromium', latestReleaseZip.name)
  );

  return { latestRelease, latestReleaseZip };
}
const chromiumZip = await getLatestChromium();

async function getLatestYTDLP() {
  console.log('Fetching latest release of yt-dlp');
  const releases = await github('GET /repos/{owner}/{repo}/releases', {
    owner: 'yt-dlp',
    repo: 'yt-dlp',
  });
  const latestRelease = releases.data[0];
  return { latestRelease };
}
const ytDLPZip = await getLatestYTDLP();

export function Layers({ stack }: StackContext) {
  const chromium = new LayerVersion(stack, 'ChromiumLayer', {
    code: Code.fromAsset(`layers/chromium/${chromiumZip.latestReleaseZip.name}`),
  });

  const ytDLP = new LayerVersion(stack, 'YTDLPLayer', {
    code: Code.fromAsset(`layers/yt-dlp/bin.zip`),
  });

  stack.addOutputs({
    ChromiumLayer: chromium.layerVersionArn,
    ChromiumVersion: chromiumZip.latestRelease.name!,
    YtDLPLayer: ytDLP.layerVersionArn,
    YtDLPVersion: ytDLPZip.latestRelease.name!,
  });
}

// function pnpmInstall(path: string) {
//   execSync(`cd ${join(__dirname, path)}`);
//   execSync('pnpm i');
// }

// https://stackoverflow.com/questions/55374755/node-js-axios-download-file-stream-and-writefile
export async function downloadFile(fileUrl: string, outputLocationPath: string): Promise<any> {
  const writer = createWriteStream(outputLocationPath);
  return axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
  }).then(response => {
    response.data.pipe(writer);
    return finished(writer); //this is a Promise
  });
}
