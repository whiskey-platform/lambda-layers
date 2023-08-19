import { Code, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { join } from 'path';
import { StackContext } from 'sst/constructs';
import { request as github } from '@octokit/request';
import axios from 'axios';
import { createWriteStream } from 'fs';
import { finished } from 'stream/promises';
import AdmZip from 'adm-zip';
import { execSync } from 'child_process';
import * as tar from 'tar';
import { copyFile } from 'fs/promises';

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
  console.log('Latest release of yt-dlp is ' + latestRelease.name);
  const latestReleaseZip = latestRelease.assets.filter(v => v.name === `yt-dlp_linux`)[0];
  console.log('downloading binary');
  await downloadFile(
    latestReleaseZip.browser_download_url,
    join('layers', 'yt-dlp', 'bin', latestReleaseZip.name)
  );
  console.log(
    'successfully downloaded binary to ' + join('layers', 'yt-dlp', 'bin', latestReleaseZip.name)
  );
  await downloadFile(
    'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
    join('layers', 'yt-dlp', 'build', 'ffmpeg.tar.xz')
  );

  tar.x({
    file: 'ffmpeg.tar.xz',
    cwd: join('layers', 'yt-dlp', 'build'),
  });

  await copyFile(
    join('layers', 'yt-dlp', 'build', 'ffmpeg', 'ffmpeg'),
    join('layers', 'yt-dlp', 'bin')
  );
  await copyFile(
    join('layers', 'yt-dlp', 'build', 'ffmpeg', 'ffprobe'),
    join('layers', 'yt-dlp', 'bin')
  );

  installYTDLPNode();

  const zip = new AdmZip();
  zip.addLocalFile(join('layers', 'yt-dlp', 'bin'));
  await zip.writeZipPromise('layer.zip');
  return { latestRelease };
}
const ytDLPZip = await getLatestYTDLP();

export function Layers({ stack }: StackContext) {
  const chromium = new LayerVersion(stack, 'ChromiumLayer', {
    code: Code.fromAsset(`layers/chromium/${chromiumZip.latestReleaseZip.name}`),
  });

  const ytDLP = new LayerVersion(stack, 'YTDLPLayer', {
    code: Code.fromAsset(`layers/yt-dlp/layer.zip`),
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

function installYTDLPNode() {
  execSync(`cd ${join(__dirname, 'layers', 'yt-dlp')}`);
  execSync('YOUTUBE_DL_SKIP_DOWNLOAD=true pnpm i');
}

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
