export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  open: boolean;
  size?: ModalSize;
  title?: string;
  description?: string;
  children?: string;
  onClose: () => void;
  closeOnOverlay?: boolean;
  showCloseButton?: boolean;
}
