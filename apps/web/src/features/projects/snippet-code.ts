export const snippetFor = (appUrl: string, siteKey: string) =>
  `<script defer src="${appUrl}/c.js" data-site="${siteKey}"></script>`
