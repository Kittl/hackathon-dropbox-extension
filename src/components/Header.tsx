import { checkmark, chevronLeft, more } from '@kittl/ui-icons';
import { Button, Icon, Menu, MenuItem, MenuTrigger, Text } from '@kittl/ui-react';

interface Props {
  /** Current page title shown in the header. */
  title: string;
  /** Whether to show the back navigation button. */
  showBack: boolean;
  /** Whether to show the kebab menu (only when connected). */
  showMenu: boolean;
  /** Whether "Hide folders" mode is currently active. */
  filesOnlyMode: boolean;
  onBack: () => void;
  onToggleFilesOnly: () => void;
  onDisconnect: () => void;
}

/**
 * Top bar of the extension.
 * Shows the current folder/page title, an optional back button for folder
 * navigation, and a kebab menu with "Hide folders" toggle and "Disconnect".
 */
export function Header({ title, showBack, showMenu, filesOnlyMode, onBack, onToggleFilesOnly, onDisconnect }: Props) {
  return (
    <div className="header">
      {showBack && (
        <Button variant="ghost" size="s" onClick={onBack}>
          <Icon icon={chevronLeft} />
        </Button>
      )}

      <div className="header-title">
        <Text variant="h4" color="default">
          <span>{title}</span>
        </Text>
      </div>

      {showMenu && (
        <Menu placement="bottom-end">
          <MenuTrigger slot="trigger">
            <Button variant="ghost" size="s">
              <div className="menu-icon-rotate">
                <Icon icon={more} />
              </div>
            </Button>
          </MenuTrigger>
          <MenuItem onMenuItemSelect={onToggleFilesOnly} className="menu-item">
            Hide folders
            {filesOnlyMode && (
              <div slot="icon-end" className="menu-item-icon-end">
                <Icon icon={checkmark} />
              </div>
            )}
          </MenuItem>
          <MenuItem onMenuItemSelect={onDisconnect} destructive className="menu-item-disconnect">
            Disconnect
          </MenuItem>
        </Menu>
      )}
    </div>
  );
}
