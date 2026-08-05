export interface DiagResponse {
  deploy: {
    commit: string;
    entorno: string;
    region: string;
    hora: string;
  };
  variables: Record<string, string>;
  base_de_datos: Record<string, string | number>;
  emails: Record<string, string>;
  problemas: string[];
  siguientes_pasos: string[];
  resumen: string;
}
