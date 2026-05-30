import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { deleteUser, getAllUsers } from '../supabase';
import type { UserRecord } from '../supabase';

export default function AdminScreen() {
  const reset = useSessionStore((s) => s.reset);

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(userId: string) {
    setDeletingId(userId);
    setConfirmDeleteId(null);
    try {
      await deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="screen" style={{ maxWidth: 680 }}>
      {/* Header */}
      <div className="screen-header">
        <div className="screen-header-info">
          <span style={adminBadgeStyle}>Admin</span>
          <h2>Account Management</h2>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: 'auto', minWidth: 80 }}
          onClick={reset}
        >
          Log Out
        </button>
      </div>

      {/* Summary card */}
      <div className="card card-sm">
        <div className="card-header" style={{ marginBottom: 0 }}>
          <div className="card-icon card-icon-primary">
            {loading ? '…' : String(users.length)}
          </div>
          <div>
            <p className="card-title">Registered Accounts</p>
            <p className="card-subtitle">
              {loading ? 'Loading...' : `${users.length} user${users.length !== 1 ? 's' : ''} in the database`}
            </p>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="card" style={{ borderLeft: '5px solid #E24B4A', color: '#991B1B' }}>
          <p style={{ margin: 0, fontWeight: 700 }}>{error}</p>
        </div>
      )}

      {/* User list */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p className="card-title" style={{ margin: 0 }}>User Accounts</p>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: 'auto', fontSize: 12, padding: '6px 14px' }}
            disabled={loading}
            onClick={loadUsers}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          /* Placeholder skeleton while loading */
          <div style={{ display: 'grid', gap: 10 }}>
            {[1, 2, 3].map((n) => (
              <div key={n} style={skeletonRowStyle}>
                <div style={{ display: 'grid', gap: 6, flex: 1 }}>
                  <div style={{ ...skeletonLineStyle, width: '40%' }} />
                  <div style={{ ...skeletonLineStyle, width: '60%', height: 10 }} />
                  <div style={{ ...skeletonLineStyle, width: '30%', height: 10 }} />
                </div>
                <div style={{ ...skeletonLineStyle, width: 64, height: 32, borderRadius: 8 }} />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <p className="card-title">No registered users yet.</p>
            <p className="card-subtitle">Accounts created via the app will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {users.map((user) => (
              <div key={user.id} style={userRowStyle}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={usernameLabelStyle}>{user.username}</p>
                  <p style={userMetaStyle}>
                    {user.building} · Unit {user.unitNumber}
                  </p>
                  <p style={userDateStyle}>
                    Registered {new Date(user.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </p>
                </div>

                {confirmDeleteId === user.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      type="button"
                      style={confirmDeleteButtonStyle}
                      disabled={deletingId === user.id}
                      onClick={() => handleDelete(user.id)}
                    >
                      {deletingId === user.id ? '…' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      style={cancelButtonStyle}
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    style={deleteButtonStyle}
                    disabled={deletingId === user.id}
                    onClick={() => setConfirmDeleteId(user.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const adminBadgeStyle: CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  fontWeight: 700,
  color: '#92400E',
  backgroundColor: '#FEF3C7',
  padding: '3px 12px',
  borderRadius: 20,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const userRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: '#ffffff',
};

const usernameLabelStyle: CSSProperties = {
  margin: 0,
  color: 'var(--text-primary)',
  fontSize: 14,
  fontWeight: 850,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const userMetaStyle: CSSProperties = {
  margin: '3px 0 0',
  color: '#475569',
  fontSize: 12,
  fontWeight: 650,
};

const userDateStyle: CSSProperties = {
  margin: '2px 0 0',
  color: '#94a3b8',
  fontSize: 11,
};

const deleteButtonStyle: CSSProperties = {
  minWidth: 64,
  minHeight: 36,
  borderRadius: 10,
  border: '1px solid #fecaca',
  background: '#fff7f7',
  color: '#b91c1c',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
  flexShrink: 0,
};

const confirmDeleteButtonStyle: CSSProperties = {
  ...deleteButtonStyle,
  background: '#E24B4A',
  color: '#ffffff',
  border: 0,
};

const cancelButtonStyle: CSSProperties = {
  minWidth: 56,
  minHeight: 36,
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: '#ffffff',
  color: '#475569',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

const skeletonRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: '#f8fafc',
  animation: 'pulse 1.5s ease-in-out infinite',
};

const skeletonLineStyle: CSSProperties = {
  height: 13,
  borderRadius: 6,
  background: '#e2e8f0',
};
