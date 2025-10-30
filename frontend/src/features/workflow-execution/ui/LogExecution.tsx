export const LogExecution = ({ logExecution }: { logExecution: any }) => {
    console.log('logExecution', logExecution)
    return (
        <div>
            <>Log Execution</>
            <div style={{ fontSize: '12px', lineHeight: '1.4', whiteSpace: 'pre-wrap', textAlign: 'left'}}>
                {logExecution.map((line: string, index: number) => (
                    <div key={index}>{line}</div>
                ))}
            </div>
        </div>
    );
};