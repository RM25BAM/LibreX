// Lightweight Persona Hosted Flow loader using CDN (sandbox-friendly)
// No npm dependency required. Uses VITE_PERSONA_TEMPLATE_ID and optional VITE_PERSONA_ENV.

declare global {
    interface Window {
        Persona?: any;
    }
}

let personaLoadingPromise: Promise<any> | null = null;

async function loadPersonaFromCdn(): Promise<any> {
    if (window.Persona) return window.Persona;
    if (personaLoadingPromise) return personaLoadingPromise;

    personaLoadingPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.withpersona.com/dist/persona-v4.0.0.min.js";
        script.async = true;
        script.onload = () => resolve(window.Persona);
        script.onerror = () => reject(new Error("Failed to load Persona SDK"));
        document.head.appendChild(script);
    });

    return personaLoadingPromise;
}

export async function startPersonaVerification(options?: {
    referenceId?: string;
    onComplete?: (inquiryId: string) => void;
    onCancel?: () => void;
    onError?: (err: Error) => void;
}) {
    const persona = await loadPersonaFromCdn();

    const templateId = import.meta.env.VITE_PERSONA_TEMPLATE_ID as string | undefined;
    const environment = (import.meta.env.VITE_PERSONA_ENV || "sandbox") as string;

    if (!templateId) {
        const err = new Error("Missing VITE_PERSONA_TEMPLATE_ID. Add it to your .env.local.");
        options?.onError?.(err);
        alert(err.message);
        return;
    }

    const client = new persona.Client({
        templateId,
        environment,
        referenceId: options?.referenceId,
        onReady: () => client.open(),
        onComplete: ({ inquiryId }: { inquiryId: string }) => {
            options?.onComplete?.(inquiryId);
        },
        onCancel: () => options?.onCancel?.(),
        onError: (e: any) => options?.onError?.(e instanceof Error ? e : new Error(String(e))),
    });
}


