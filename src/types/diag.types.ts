export interface DiagResponse {
  deploy: Record<string, string>;
  variables: Record<string, string>;
  base_de_datos: Record<string, string | number>;
  emails: Record<string, string>;
  problemas: string[];
  siguientes_pasos: string[];
  resumen: string;
}
