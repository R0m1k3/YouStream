const http = require('http');

const url = 'http://localhost:3002/api/v1/videos/0e3GPea1Tyg';

http.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('Status Code:', res.statusCode);
            console.log('Keys:', Object.keys(json));
            if (json.formatStreams) {
                console.log('FormatStreams Length:', json.formatStreams.length);
                console.log('First Stream:', JSON.stringify(json.formatStreams[0], null, 2));
            } else {
                console.log('NO formatStreams found!');
            }
            if (json.adaptiveFormats) {
                console.log('AdaptiveFormats Length:', json.adaptiveFormats.length);
                console.log('First Adaptive:', JSON.stringify(json.adaptiveFormats[0], null, 2));
            }
        } catch (e) {
            console.error('Error parsing JSON:', e.message);
            console.log('Raw Data Preview:', data.substring(0, 500));
        }
    });
}).on('error', (err) => {
    console.error('Error fetching:', err.message);
});
