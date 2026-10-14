import packageJson from "../../package.json";

function titleCasePackageName(name: string): string {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const appConfig = {
  packageName: packageJson.name,
  displayName:
    process.env.APP_DISPLAY_NAME?.trim() ||
    (packageJson.name.startsWith("ai-starter")
      ? "AI Starter"
      : titleCasePackageName(packageJson.name)),
};
