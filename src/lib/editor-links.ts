/** Links into the content editor. With GitHub storage, its pages live under the branch being edited. */
export const editsGoToGitHub = import.meta.env.PUBLIC_KEYSTATIC_GITHUB === 'true';

export const editorLink = (path: string) => (editsGoToGitHub ? `/keystatic/branch/main/${path}` : `/keystatic/${path}`);
