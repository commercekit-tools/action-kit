export function validateNotificationLink(value: string): URL {
  try {
    if (value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) throw Error();
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || value.includes('#'))
      throw Error();
    return url;
  } catch {
    throw new Error('Invalid notification HTTPS link.');
  }
}
// Run URLs use the v1 HTTPS policy, including GitHub Enterprise installations.
export function validateGitHubRunUrl(value: string): URL {
  return validateNotificationLink(value);
}
