const fs = require('fs');
const path = require('path');
const os = require('os');

const CRED_FILE = path.join(os.homedir(), 'AppData', 'Roaming', 'brightdata-cli', 'credentials.json');
const KEYS_FILE = path.join(__dirname, '..', 'data', 'bd-keys.txt');

function loadKeys() {
    if (!fs.existsSync(KEYS_FILE)) return [];
    return fs.readFileSync(KEYS_FILE, 'utf-8').split('\n').map(s => s.trim()).filter(Boolean);
}

function mask(key) {
    return key.length <= 8 ? '****' : `${key.slice(0, 4)}****${key.slice(-4)}`;
}

const cmd = process.argv[2] || 'list';

if (cmd === 'add') {
    if (!fs.existsSync(CRED_FILE)) {
        console.error('No stored login found. First run: npx -p @brightdata/cli bdata login');
        process.exit(1);
    }
    const key = JSON.parse(fs.readFileSync(CRED_FILE, 'utf-8')).api_key;
    const keys = loadKeys();
    if (keys.includes(key)) {
        console.log('Key already collected:', mask(key));
    } else {
        keys.push(key);
        fs.mkdirSync(path.dirname(KEYS_FILE), { recursive: true });
        fs.writeFileSync(KEYS_FILE, keys.join('\n') + '\n');
        console.log(`Collected key #${keys.length}:`, mask(key));
    }
    console.log('\nNext: logout, then login with the next teammate account:');
    console.log('  npx -p @brightdata/cli bdata logout');
    console.log('  npx -p @brightdata/cli bdata login');
} else if (cmd === 'clear') {
    fs.writeFileSync(KEYS_FILE, '');
    console.log('Cleared all collected keys.');
} else {
    const keys = loadKeys();
    if (!keys.length) {
        console.log('No keys collected yet. Flow per teammate account:');
        console.log('  1. npx -p @brightdata/cli bdata login      (browser opens, login with that account)');
        console.log('  2. node scripts/collect-keys.js add');
        console.log('  3. repeat for next account');
        process.exit(0);
    }
    console.log(`Collected ${keys.length} key(s):`);
    keys.forEach((k, i) => console.log(`  #${i + 1} ${mask(k)}`));
    console.log('\nStart server with rotation:');
    console.log(`  CMD:       set BRIGHTDATA_API_KEYS=${keys.join(',')} && npm start`);
    console.log(`  PowerShell: $env:BRIGHTDATA_API_KEYS="${keys.join(',')}"; npm start`);
}
