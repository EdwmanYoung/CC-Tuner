import { ProfileManager } from "../services/profile-manager";
import { ConfigManager } from "../services/config-manager";
import { SecurityService } from "../services/security";
import { ValidatorService } from "../services/validator";
import { BackupManager } from "../services/backup-manager";
import { ShellService } from "../services/shell-service";
import { HistoryManager } from "../services/history-manager";
import { registerProfileHandlers } from "./profiles";
import { registerConfigHandlers } from "./config";
import { registerBackupHandlers } from "./backup";
import { registerShellHandlers } from "./shell";
import { registerHistoryHandlers } from "./history";
import { registerDialogHandlers } from "./dialog";

export function registerIpcHandlers(
  pm: ProfileManager,
  cm: ConfigManager,
  ss: SecurityService,
  vs: ValidatorService,
  bm: BackupManager,
  shs: ShellService,
  hm: HistoryManager,
): void {
  registerProfileHandlers(pm, ss, hm);
  registerConfigHandlers(pm, cm, ss, vs, bm, hm);
  registerBackupHandlers(bm);
  registerShellHandlers(shs);
  registerHistoryHandlers(hm);
  registerDialogHandlers();
}
