/**
 * Makes Chromium's WebGL2 look like Safari's to Rive: Rive draws with
 * WEBGL_shader_pixel_local_storage when a context has it (Chromium does, Safari does not) and
 * otherwise falls back to a slower path. Hiding the extension puts Rive on the path an iPhone
 * uses. Rive reads it once per context, so this must run before the first Rive canvas exists and
 * cannot be undone without a reload.
 */
const PLS = 'WEBGL_shader_pixel_local_storage'

let hidden = false

export const hidePixelLocalStorage = (): void => {
  if (hidden || typeof WebGL2RenderingContext === 'undefined') return
  const proto = WebGL2RenderingContext.prototype
  const getExtension = proto.getExtension
  const getSupported = proto.getSupportedExtensions
  const patched = function (this: WebGL2RenderingContext, name: string) {
    return name === PLS ? null : (getExtension as (name: string) => unknown).call(this, name)
  }
  proto.getExtension = patched as typeof proto.getExtension
  proto.getSupportedExtensions = function (this: WebGL2RenderingContext) {
    return getSupported.call(this)?.filter(name => name !== PLS) ?? null
  }
  hidden = true
}

/** Whether a fresh WebGL2 context offers the fast path — for the HUD and the report. */
export const hasPixelLocalStorage = (): boolean => {
  if (typeof document === 'undefined') return false
  const gl = document.createElement('canvas').getContext('webgl2')
  const ok = Boolean(gl?.getExtension(PLS))
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
  return ok
}
