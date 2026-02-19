export type FSNodeType = 'file' | 'directory' | 'symlink';

export interface FSNode {
  name: string;
  type: FSNodeType;
  content?: string;
  children?: Map<string, FSNode>;
  target?: string; // for symlinks
  permissions?: string;
  modified?: number;
}

export interface FSNodeJSON {
  name: string;
  type: FSNodeType;
  content?: string;
  children?: Record<string, FSNodeJSON>;
  target?: string;
  permissions?: string;
}

export class VirtualFileSystem {
  private root: FSNode;

  constructor() {
    this.root = {
      name: '/',
      type: 'directory',
      children: new Map(),
      permissions: 'drwxr-xr-x',
    };
  }

  /** Load filesystem from a plain object (parsed from YAML) */
  loadFromJSON(tree: Record<string, FSNodeJSON>): void {
    this.root.children = new Map();
    this._loadChildren(this.root, tree);
  }

  private _loadChildren(parent: FSNode, tree: Record<string, FSNodeJSON>): void {
    for (const [name, node] of Object.entries(tree)) {
      const fsNode: FSNode = {
        name,
        type: node.type || (node.children ? 'directory' : 'file'),
        content: node.content,
        permissions: node.permissions,
        target: node.target,
        modified: Date.now(),
      };
      if (fsNode.type === 'directory') {
        fsNode.children = new Map();
        if (node.children) {
          this._loadChildren(fsNode, node.children);
        }
      }
      parent.children!.set(name, fsNode);
    }
  }

  /** Resolve a path string to a FSNode, following symlinks */
  resolve(path: string, cwd: string = '/'): FSNode | null {
    const parts = this._resolveParts(path, cwd);
    return this._walk(parts);
  }

  /** Resolve the absolute path string */
  resolvePath(path: string, cwd: string = '/'): string {
    const parts = this._resolveParts(path, cwd);
    return '/' + parts.join('/');
  }

  private _resolveParts(path: string, cwd: string): string[] {
    const isAbsolute = path.startsWith('/');
    const baseParts = isAbsolute ? [] : cwd.split('/').filter(Boolean);
    const inputParts = path.split('/').filter(Boolean);
    const resolved: string[] = [...baseParts];

    for (const part of inputParts) {
      if (part === '.') continue;
      if (part === '..') {
        resolved.pop();
      } else {
        resolved.push(part);
      }
    }
    return resolved;
  }

  private _walk(parts: string[], followSymlinks: boolean = true, depth: number = 0): FSNode | null {
    if (depth > 20) return null; // prevent infinite symlink loops
    let current = this.root;
    for (let i = 0; i < parts.length; i++) {
      if (current.type !== 'directory' || !current.children) return null;
      const child = current.children.get(parts[i]);
      if (!child) return null;
      if (child.type === 'symlink' && followSymlinks && child.target) {
        const targetParts = this._resolveParts(child.target, '/' + parts.slice(0, i).join('/'));
        const targetNode = this._walk(targetParts, true, depth + 1);
        if (!targetNode) return null;
        current = targetNode;
      } else {
        current = child;
      }
    }
    return current;
  }

  readFile(path: string, cwd: string = '/'): string | null {
    const node = this.resolve(path, cwd);
    if (!node || node.type !== 'file') return null;
    return node.content ?? '';
  }

  writeFile(path: string, content: string, cwd: string = '/'): boolean {
    const absPath = this.resolvePath(path, cwd);
    const parts = absPath.split('/').filter(Boolean);
    const fileName = parts.pop()!;
    const parentPath = '/' + parts.join('/');
    const parent = this.resolve(parentPath, '/');
    if (!parent || parent.type !== 'directory') return false;

    const existing = parent.children!.get(fileName);
    if (existing && existing.type === 'directory') return false;

    parent.children!.set(fileName, {
      name: fileName,
      type: 'file',
      content,
      permissions: '-rw-r--r--',
      modified: Date.now(),
    });
    return true;
  }

  appendFile(path: string, content: string, cwd: string = '/'): boolean {
    const node = this.resolve(path, cwd);
    if (node && node.type === 'file') {
      node.content = (node.content ?? '') + content;
      node.modified = Date.now();
      return true;
    }
    // If file doesn't exist, create it
    return this.writeFile(path, content, cwd);
  }

  listDir(path: string, cwd: string = '/'): FSNode[] | null {
    const node = this.resolve(path, cwd);
    if (!node || node.type !== 'directory' || !node.children) return null;
    return Array.from(node.children.values());
  }

  mkdir(path: string, cwd: string = '/', recursive: boolean = false): boolean {
    const absPath = this.resolvePath(path, cwd);
    const parts = absPath.split('/').filter(Boolean);

    if (recursive) {
      let current = this.root;
      for (const part of parts) {
        if (!current.children) return false;
        let child = current.children.get(part);
        if (!child) {
          child = {
            name: part,
            type: 'directory',
            children: new Map(),
            permissions: 'drwxr-xr-x',
            modified: Date.now(),
          };
          current.children.set(part, child);
        } else if (child.type !== 'directory') {
          return false;
        }
        current = child;
      }
      return true;
    }

    const dirName = parts.pop()!;
    const parentPath = '/' + parts.join('/');
    const parent = this.resolve(parentPath, '/');
    if (!parent || parent.type !== 'directory') return false;
    if (parent.children!.has(dirName)) return false;

    parent.children!.set(dirName, {
      name: dirName,
      type: 'directory',
      children: new Map(),
      permissions: 'drwxr-xr-x',
      modified: Date.now(),
    });
    return true;
  }

  rm(path: string, cwd: string = '/', recursive: boolean = false): boolean {
    const absPath = this.resolvePath(path, cwd);
    const parts = absPath.split('/').filter(Boolean);
    if (parts.length === 0) return false; // can't remove root

    const fileName = parts.pop()!;
    const parentPath = '/' + parts.join('/');
    const parent = this.resolve(parentPath, '/');
    if (!parent || parent.type !== 'directory') return false;

    const target = parent.children!.get(fileName);
    if (!target) return false;
    if (target.type === 'directory' && !recursive) return false;

    parent.children!.delete(fileName);
    return true;
  }

  exists(path: string, cwd: string = '/'): boolean {
    return this.resolve(path, cwd) !== null;
  }

  isDirectory(path: string, cwd: string = '/'): boolean {
    const node = this.resolve(path, cwd);
    return node !== null && node.type === 'directory';
  }

  isFile(path: string, cwd: string = '/'): boolean {
    const node = this.resolve(path, cwd);
    return node !== null && node.type === 'file';
  }

  /** Find files matching a glob-like pattern (simple implementation) */
  find(basePath: string, pattern: string, cwd: string = '/'): string[] {
    const results: string[] = [];
    const base = this.resolve(basePath, cwd);
    if (!base || base.type !== 'directory') return results;

    const absBase = this.resolvePath(basePath, cwd);
    const regex = this._globToRegex(pattern);

    this._findRecursive(base, absBase, regex, results);
    return results;
  }

  private _findRecursive(node: FSNode, currentPath: string, regex: RegExp, results: string[]): void {
    if (!node.children) return;
    for (const [name, child] of node.children) {
      const childPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
      if (regex.test(name)) {
        results.push(childPath);
      }
      if (child.type === 'directory') {
        this._findRecursive(child, childPath, regex, results);
      }
    }
  }

  /** Search file contents for a pattern */
  grep(pattern: string, path: string, cwd: string = '/', recursive: boolean = false): Array<{ file: string; line: number; content: string }> {
    const results: Array<{ file: string; line: number; content: string }> = [];
    const node = this.resolve(path, cwd);
    if (!node) return results;

    const absPath = this.resolvePath(path, cwd);

    if (node.type === 'file') {
      this._grepFile(node, absPath, pattern, results);
    } else if (node.type === 'directory' && recursive) {
      this._grepRecursive(node, absPath, pattern, results);
    }
    return results;
  }

  private _grepFile(node: FSNode, filePath: string, pattern: string, results: Array<{ file: string; line: number; content: string }>): void {
    if (!node.content) return;
    const regex = new RegExp(pattern, 'g');
    const lines = node.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        results.push({ file: filePath, line: i + 1, content: lines[i] });
        regex.lastIndex = 0;
      }
    }
  }

  private _grepRecursive(node: FSNode, currentPath: string, pattern: string, results: Array<{ file: string; line: number; content: string }>): void {
    if (!node.children) return;
    for (const [name, child] of node.children) {
      const childPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
      if (child.type === 'file') {
        this._grepFile(child, childPath, pattern, results);
      } else if (child.type === 'directory') {
        this._grepRecursive(child, childPath, pattern, results);
      }
    }
  }

  /** Get tab completion candidates for a partial path */
  completePath(partial: string, cwd: string = '/'): string[] {
    const absPartial = this.resolvePath(partial, cwd);
    const parts = absPartial.split('/').filter(Boolean);
    const lastPart = parts.pop() || '';
    const parentPath = '/' + parts.join('/');
    const parent = this.resolve(parentPath, '/');

    if (!parent || parent.type !== 'directory' || !parent.children) return [];

    const candidates: string[] = [];
    for (const [name, child] of parent.children) {
      if (name.startsWith(lastPart)) {
        candidates.push(child.type === 'directory' ? name + '/' : name);
      }
    }
    return candidates.sort();
  }

  /** Serialize the entire filesystem to JSON (for snapshots) */
  toJSON(): FSNodeJSON {
    return this._nodeToJSON(this.root);
  }

  private _nodeToJSON(node: FSNode): FSNodeJSON {
    const json: FSNodeJSON = {
      name: node.name,
      type: node.type,
    };
    if (node.content !== undefined) json.content = node.content;
    if (node.target) json.target = node.target;
    if (node.permissions) json.permissions = node.permissions;
    if (node.children) {
      json.children = {};
      for (const [name, child] of node.children) {
        json.children[name] = this._nodeToJSON(child);
      }
    }
    return json;
  }

  /** Restore from a JSON snapshot */
  fromJSON(json: FSNodeJSON): void {
    this.root = this._jsonToNode(json);
  }

  private _jsonToNode(json: FSNodeJSON): FSNode {
    const node: FSNode = {
      name: json.name,
      type: json.type,
      content: json.content,
      target: json.target,
      permissions: json.permissions,
      modified: Date.now(),
    };
    if (json.children) {
      node.children = new Map();
      for (const [name, child] of Object.entries(json.children)) {
        node.children.set(name, this._jsonToNode(child));
      }
    }
    return node;
  }

  private _globToRegex(glob: string): RegExp {
    const escaped = glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }
}
