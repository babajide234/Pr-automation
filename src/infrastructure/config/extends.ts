import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";
import { ConfigurationError } from "../../domain/errors";

function readYamlIfPresent(filePath: string): string | undefined {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return fs.readFileSync(filePath, "utf8");
    }
    return undefined;
}

function looksLikeLocalPath(spec: string): boolean {
    return (
        spec.startsWith(".") ||
        spec.startsWith("/") ||
        spec.endsWith(".yml") ||
        spec.endsWith(".yaml")
    );
}

async function fetchText(url: string, spec: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new ConfigurationError(
            `Failed to resolve extends '${spec}': HTTP ${response.status}`,
        );
    }
    return response.text();
}

async function resolveGitExtends(spec: string): Promise<string | undefined> {
    const github = spec.match(/^github:([^/]+)\/([^@]+)@([^:]+)(?::(.+))?$/);
    if (github) {
        const [, owner, repo, ref, filePath = ".pr-doc.yml"] = github;
        return fetchText(
            `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`,
            spec,
        );
    }

    const short = spec.match(/^([^/@]+)\/([^@]+)@([^:]+)(?::(.+))?$/);
    if (short && !spec.startsWith("@")) {
        const [, owner, repo, ref, filePath = ".pr-doc.yml"] = short;
        return fetchText(
            `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`,
            spec,
        );
    }

    return undefined;
}

function resolveNpmExtends(spec: string): string {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pr-doc-extends-"));
    try {
        execSync(`npm pack ${spec} --pack-destination "${tmp}"`, {
            stdio: ["pipe", "pipe", "pipe"],
        });
        const tarball = fs.readdirSync(tmp).find((file) => file.endsWith(".tgz"));
        if (!tarball) {
            throw new ConfigurationError(`Failed to resolve extends '${spec}'.`);
        }
        execSync(`tar -xzf "${path.join(tmp, tarball)}" -C "${tmp}"`, {
            stdio: ["pipe", "pipe", "pipe"],
        });
        const pkgDir = path.join(tmp, "package");
        const candidates = [".pr-doc.yml", "pr-doc.yml"];
        const pkgJsonPath = path.join(pkgDir, "package.json");
        if (fs.existsSync(pkgJsonPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8")) as {
                prDoc?: string;
            };
            if (pkg.prDoc) {
                candidates.unshift(pkg.prDoc);
            }
        }
        for (const candidate of candidates) {
            const found = readYamlIfPresent(path.join(pkgDir, candidate));
            if (found !== undefined) {
                return found;
            }
        }
        throw new ConfigurationError(
            `extends package '${spec}' does not contain a .pr-doc.yml.`,
        );
    } catch (error) {
        if (error instanceof ConfigurationError) {
            throw error;
        }
        throw new ConfigurationError(`Failed to resolve extends '${spec}'.`);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export async function resolveExtendsYaml(
    spec: string,
    fromDir: string,
): Promise<string> {
    if (!spec.trim()) {
        return "";
    }

    if (looksLikeLocalPath(spec)) {
        const resolved = path.resolve(fromDir, spec);
        const contents = readYamlIfPresent(resolved);
        if (contents === undefined) {
            throw new ConfigurationError(`extends path not found: ${spec}`);
        }
        return contents;
    }

    const gitYaml = await resolveGitExtends(spec);
    if (gitYaml !== undefined) {
        return gitYaml;
    }

    return resolveNpmExtends(spec);
}
