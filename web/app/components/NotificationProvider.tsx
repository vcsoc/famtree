"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type NotificationType = 'success' | 'error' | 'confirm';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  noAutoHide?: boolean;
}

interface NotificationContextType {
  showAlert: (message: string, type?: 'success' | 'error') => void;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
  showCustomConfirm: (message: string, buttons: Array<{label: string, onClick: () => void, variant?: 'primary' | 'secondary' | 'danger'}>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const showAlert = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, type, message }]);
    
    setTimeout(() => {
      removeNotification(id);
    }, 3000);
  }, [removeNotification]);

  const showConfirm = useCallback((message: string, title?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).substr(2, 9);
      setNotifications(prev => [...prev, { 
        id, 
        type: 'confirm', 
        message, 
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
        noAutoHide: true
      }]);
    });
  }, []);

  const showCustomConfirm = useCallback((message: string, buttons: Array<{label: string, onClick: () => void, variant?: 'primary' | 'secondary' | 'danger'}>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { 
      id, 
      type: 'confirm', 
      message, 
      noAutoHide: true,
      customButtons: buttons 
    } as any]);
  }, []);

  const handleConfirm = (notification: Notification) => {
    if (notification.onConfirm) notification.onConfirm();
    removeNotification(notification.id);
  };

  const handleCancel = (notification: Notification) => {
    if (notification.onCancel) notification.onCancel();
    removeNotification(notification.id);
  };

  return (
    <NotificationContext.Provider value={{ showAlert, showConfirm, showCustomConfirm }}>
      {children}
      <div className="notification-container">
        {notifications.map((notification: any) => (
          <div
            key={notification.id}
            className={`notification notification-${notification.type}`}
          >
            <div className="notification-message">{notification.message}</div>
            {notification.type === 'confirm' && (
              <div className="notification-actions">
                {notification.customButtons ? (
                  notification.customButtons.map((btn: any, idx: number) => (
                    <button
                      key={idx}
                      className={`notification-btn notification-btn-${btn.variant || 'secondary'}`}
                      onClick={() => {
                        btn.onClick();
                        removeNotification(notification.id);
                      }}
                    >
                      {btn.label}
                    </button>
                  ))
                ) : (
                  <>
                    <button
                      className="notification-btn notification-btn-confirm"
                      onClick={() => handleConfirm(notification)}
                    >
                      Yes
                    </button>
                    <button
                      className="notification-btn notification-btn-cancel"
                      onClick={() => handleCancel(notification)}
                    >
                      No
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}
