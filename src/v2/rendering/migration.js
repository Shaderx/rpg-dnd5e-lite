/**
 * V2 Tool Calling - Migration Modal
 * Shows a confirmation dialog when migrating V1 data to V2 format.
 */

/**
 * Show the V2 migration modal.
 * @param {Function} onConfirm - Called when user confirms migration
 */
export function showV2MigrationModal(onConfirm) {
    const overlay = document.getElementById('dnd-v2-migration-popup');
    if (!overlay) return;
    overlay.style.display = '';

    const confirmBtn = document.getElementById('dnd-v2-migration-confirm');
    const cancelBtn = document.getElementById('dnd-v2-migration-cancel');
    const closeBtn = document.getElementById('dnd-v2-migration-close');

    function cleanup() {
        overlay.style.display = 'none';
        confirmBtn?.removeEventListener('click', handleConfirm);
        cancelBtn?.removeEventListener('click', handleCancel);
        closeBtn?.removeEventListener('click', handleCancel);
    }

    function handleConfirm() {
        cleanup();
        if (onConfirm) onConfirm();
    }

    function handleCancel() {
        cleanup();
    }

    confirmBtn?.addEventListener('click', handleConfirm);
    cancelBtn?.addEventListener('click', handleCancel);
    closeBtn?.addEventListener('click', handleCancel);
}
