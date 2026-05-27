export interface StorageService {
  isWebMode(): boolean;
  init(): Promise<boolean>;
  loadJsonByPath(path: string): Promise<any>;
  selectFileDialog(): Promise<any>;
  saveData(data: any): Promise<[boolean, string | null]>;
  saveAsData(data: any): Promise<[boolean, string | null]>;
  getRecentFiles(): Promise<string[]>;
  openFile(filePath: string): Promise<boolean>;
  openFolder(folderPath: string): Promise<boolean>;
  selectAnyFile(): Promise<string>;
  selectFolder(): Promise<string>;
  getOgpImage(url: string): Promise<string | null>;
}
