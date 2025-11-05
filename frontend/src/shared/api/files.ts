export interface CreateFileRequest {
  filename?: string;
  content: string;
}

export interface CreateFileResponse {
  fileId: string;
  filename: string;
  size: number;
}

export const createFileOnServer = async (req: CreateFileRequest): Promise<CreateFileResponse> => {
  const res = await fetch('/api/files/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(await res.text())
  return await res.json()
}

export const getDownloadUrl = (fileId: string) => `/api/files/download/${fileId}`

export interface UploadFileResponse {
  fileId: string;
  filename: string;
  size: number;
  mimetype?: string;
}

export const uploadFileToServer = async (file: File): Promise<UploadFileResponse> => {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/files/upload', {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error(await res.text())
  return await res.json()
}


