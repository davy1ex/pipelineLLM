import os
import logging
from typing import Dict, Any, Optional

from executors.base import ExecutorResult

logger = logging.getLogger(__name__)

# Cache DocumentConverter instance to avoid re-downloading models/fonts
_cached_converter: Optional[Any] = None


def _resolve_file_path_by_id(file_id: str) -> Optional[str]:
    base_dir = os.path.join('/tmp', 'pipeline_files')
    if not os.path.isdir(base_dir):
        return None
    for name in os.listdir(base_dir):
        if name.startswith(file_id + "__"):
            return os.path.join(base_dir, name)
    return None


def _get_converter():
    """Get or create cached DocumentConverter instance."""
    global _cached_converter
    if _cached_converter is None:
        from docling.document_converter import DocumentConverter  # type: ignore
        
        logger.info('Docling: Creating DocumentConverter (cached for reuse)')
        # Use standard converter - Docling will prioritize text extraction from PDF layer
        # OCR will only run if needed for images, but text extraction is faster
        _cached_converter = DocumentConverter()
        logger.info('Docling: DocumentConverter initialized and cached')
    return _cached_converter


def _convert_to_markdown(file_path: str) -> str:
    try:
        import time
        converter = _get_converter()
        
        start_time = time.time()
        logger.debug('Docling: Starting convert() for %s', os.path.basename(file_path))
        result = converter.convert(file_path)
        convert_time = time.time() - start_time
        
        logger.debug('Docling: Conversion complete in %.2fs, exporting to markdown', convert_time)
        export_start = time.time()
        markdown_text = result.document.export_to_markdown()
        export_time = time.time() - export_start
        
        logger.info('Docling: Conversion took %.2fs (convert: %.2fs, export: %.2fs), %d chars', 
                   convert_time + export_time, convert_time, export_time, len(markdown_text))
        return markdown_text
    except ModuleNotFoundError:
        # Lightweight fallback for development without docling installed
        ext = os.path.splitext(file_path)[1].lower()
        if ext in ['.md', '.txt']:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        raise RuntimeError('docling is not installed. Please add docling to requirements and install dependencies.')


def execute_docling(node: Dict[str, Any], inputs: Dict[str, Any]) -> ExecutorResult:
    data = node.get('data', {}) or {}

    # Accept fileId either from node.data or upstream inputs (robust resolution)
    file_id: Optional[str] = None
    filename: Optional[str] = data.get('filename')  # Get filename for better error messages
    candidate = data.get('fileId')
    if isinstance(candidate, str) and candidate:
        file_id = candidate
    elif isinstance(inputs.get('fileId'), str) and inputs.get('fileId'):
        file_id = inputs.get('fileId')  # type: ignore
    elif isinstance(inputs.get('input'), dict):
        maybe = inputs.get('input')  # type: ignore
        inner = maybe.get('fileId') if isinstance(maybe, dict) else None
        if isinstance(inner, str) and inner:
            file_id = inner
    elif isinstance(inputs.get('inputFileId'), str) and inputs.get('inputFileId'):
        file_id = inputs.get('inputFileId')  # type: ignore

    if not file_id or not isinstance(file_id, str):
        return ExecutorResult(
            output='',
            error='Docling node requires a fileId (upload a PDF/DOCX/TXT first)',
            metadata={'fileId': None, 'filename': filename}
        )

    file_path = _resolve_file_path_by_id(file_id)
    if not file_path:
        # Provide detailed error with filename if available
        file_info = f"filename='{filename}'" if filename else ''
        error_msg = f"File not found (fileId={file_id}{', ' + file_info if file_info else ''}). The file may have been deleted or the container was restarted. Please upload the file again."
        logger.warning(error_msg)
        return ExecutorResult(
            output='',
            error=error_msg,
            metadata={'fileId': file_id, 'filename': filename, 'fileNotFound': True}
        )

    logger.info('Docling executor: Starting conversion for %s (fileId=%s)', os.path.basename(file_path), file_id)
    try:
        markdown = _convert_to_markdown(file_path)
        logger.info('Docling executor: Successfully converted %s to markdown (%d chars)', os.path.basename(file_path), len(markdown))
        return ExecutorResult(
            output=markdown,
            error=None,
            metadata={
                'fileId': file_id,
                'filename': os.path.basename(file_path).split('__', 1)[-1],
                'length': len(markdown),
            }
        )
    except Exception as e:
        logger.error('Docling conversion failed: %s', str(e), exc_info=True)
        return ExecutorResult(
            output='',
            error=f'Docling conversion failed: {str(e)}',
            metadata={'fileId': file_id}
        )


