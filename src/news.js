export async function fetchNews() {
    const response = await fetch('https://demo-feed-data.tradingview.com/tv_news');
    const xml = await response.text();
    const parser = new DOMParser();
    const dom = parser.parseFromString(xml, 'application/xml');
    const items = dom.querySelectorAll('item');

    return Array.from(items).map(item => {
        const title = item.querySelector('title').textContent;
        const link = item.querySelector('link').textContent;
        const description = item.querySelector('description')?.textContent ?? '';
        const pubDate = item.querySelector('pubDate').textContent;
        const contentNode = Array.from(item.childNodes).find(el => el.tagName === 'content:encoded');
        let decodedContent = '';
        if (contentNode) {
            const tempElement = document.createElement("div");
            tempElement.innerHTML = contentNode.textContent ?? '';
            decodedContent = tempElement.innerText;
        }
        return {
            // fullDescription: decodedContent,
            link,
            published: new Date(pubDate).valueOf(),
            shortDescription: decodedContent ? (decodedContent.slice(0, 150) + '...') : '',
            provider: {
                id: 'tradingview',
                name: 'TradingView',
            },
            title,
        };
    });
}

// work in progress
async function cryptoNews() {
    const response = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
    const data = await response.json();
    return data.Data.map(item => ({
        title: item.title,
        link: item.url,
    }));       
}