const { platform, arch } = process;
let target;
if (platform === 'darwin' && (arch === 'arm64' || arch === 'x64')) {
  target = platform + '-' + arch;
} else if (platform === 'win32' && (arch === 'arm64' || arch === 'x64')) {
  target = platform + '-' + arch + '-msvc';
} else if (platform === 'linux' && (arch === 'arm64' || arch === 'x64')) {
  const report = process.report.getReport();
  const libc = report.header.glibcVersionRuntime ? 'gnu' : 'musl';
  target = platform + '-' + arch + '-' + libc;
} else {
  throw new Error('Hetzner Cloud credential storage does not support ' + platform + '/' + arch + '.');
}
const binding = require('./keyring.' + target + '.node');
exports.AsyncEntry = binding.AsyncEntry;
