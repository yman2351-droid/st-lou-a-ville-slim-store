import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/'
});
const { window } = dom;
const browserGlobals = {
    window,
    document: window.document,
    navigator: window.navigator,
    HTMLElement: window.HTMLElement,
    MutationObserver: window.MutationObserver,
    Node: window.Node,
    getComputedStyle: window.getComputedStyle.bind(window),
    IS_REACT_ACT_ENVIRONMENT: true
};

for (const [name, value] of Object.entries(browserGlobals)) {
    Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value
    });
}
