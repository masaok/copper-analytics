/** Cache tags. A flush revalidates both for every project it touched. */
export const projectTag = (siteKey: string) => `project:${siteKey}`
export const ownerTag = (ownerId: string) => `owner:${ownerId}`
