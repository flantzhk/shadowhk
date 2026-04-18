import styles from './FlowMap.module.css';

/**
 * FlowMap — breadcrumb step indicator for multi-step flows.
 * @param {string[]} steps       - step labels
 * @param {number}   activeIndex - 0-based index of current step
 */
export function FlowMap({ steps = [], activeIndex = 0 }) {
  return (
    <div className={styles.flowmap}>
      {steps.map((label, i) => {
        const isDone = i < activeIndex;
        const isActive = i === activeIndex;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && (
              <div className={`${styles.connector} ${isDone ? styles.connectorDone : ''}`} />
            )}
            <div className={`${styles.step} ${isActive ? styles.stepActive : ''} ${isDone ? styles.stepDone : ''}`}>
              <div className={`${styles.circle} ${isDone ? styles.circleDone : ''} ${isActive ? styles.circleActive : ''}`}>
                {isDone ? '✓' : i + 1}
              </div>
              <span>{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
