/**
 * CONTENIDO DEL PRODUCTO (catálogos globales). No son datos de una clínica.
 * Las referencias a artículos de la Ley 21.719 son orientativas y deben ser validadas por un abogado.
 */
export const QUESTIONS = [
  { id: 'q1', area: 'Gobierno', article: 'Art. 49', critical: false, impact: 2, text: '¿Hay una persona designada como responsable de privacidad (encargado o delegado de protección de datos)?',
    taskControl: 'Designar delegado/encargado de protección de datos y formalizarlo por escrito', taskRisk: 'Nadie responde por el cumplimiento ante la Agencia',
    recNo: 'Designe por escrito a una persona responsable de privacidad (puede ser la directora clínica o administración) y dele tiempo asignado. Es la base para todo lo demás.',
    recPartial: 'Formalice la designación por escrito y defina sus funciones: atender solicitudes, revisar proveedores y coordinar incidentes.' },
  { id: 'q2', area: 'Inventario', article: 'Art. 3 · Art. 14', critical: false, impact: 3, text: '¿Tienen un registro de todos los tratamientos de datos (ficha, agenda, imágenes, marketing, personal)?',
    taskControl: 'Completar el inventario de tratamientos de datos', taskRisk: 'No se puede demostrar qué datos se tratan ni para qué',
    recNo: 'Registre en el inventario cada uso de datos: ficha, radiografías, agenda, cobros, laboratorio, fotos, cámaras y personal. Se hace en una tarde con el equipo.',
    recPartial: 'Complete los tratamientos que faltan, sobre todo marketing, WhatsApp y cámaras, que suelen olvidarse.' },
  { id: 'q3', area: 'Información', article: 'Art. 14 ter', critical: false, impact: 2, text: '¿Los pacientes reciben una política de privacidad clara (recepción, sitio web, ficha de ingreso)?',
    taskControl: 'Publicar política de privacidad y aviso en recepción', taskRisk: 'Incumplimiento del deber de información y transparencia',
    recNo: 'Publique la política de privacidad en el sitio web y ponga el aviso breve en recepción. Ambos borradores están en Documentos.',
    recPartial: 'Revise que la política mencione fotos clínicas, laboratorio, mensajería y el plazo de 30 días para solicitudes.' },
  { id: 'q4', area: 'Consentimiento', article: 'Art. 12 · Art. 16', critical: true, impact: 1, text: '¿Piden consentimiento expreso y separado antes de usar fotos clínicas (antes/después) en redes sociales?',
    taskControl: 'Implementar formulario de consentimiento expreso para fotos clínicas', taskRisk: 'Tratamiento de datos sensibles sin base de licitud',
    recNo: 'Deje de publicar fotos de pacientes hasta tener su consentimiento firmado. Use el formulario de consentimiento para fotos clínicas y revise las publicaciones actuales.',
    recPartial: 'Separe el consentimiento de fotos del consentimiento del tratamiento clínico y pida firma nueva a los pacientes ya publicados.' },
  { id: 'q5', area: 'Derechos', article: 'Art. 4–11', critical: true, impact: 1, text: '¿Existe un canal y un procedimiento para responder solicitudes de pacientes dentro de 30 días corridos?',
    taskControl: 'Habilitar portal de derechos y procedimiento interno de respuesta', taskRisk: 'Solicitudes vencidas y reclamos ante la Agencia',
    recNo: 'Habilite un correo de privacidad y el formulario para pacientes, y defina quién responde. El plazo legal es de 30 días corridos.',
    recPartial: 'Documente el procedimiento paso a paso e incluya la verificación de identidad antes de entregar copias de fichas.' },
  { id: 'q6', area: 'Seguridad', article: 'Art. 14 quinquies', critical: true, impact: 1, text: '¿El acceso a la ficha clínica es con usuario individual y permisos según el rol (recepción no ve diagnósticos)?',
    taskControl: 'Configurar usuarios nominativos y perfiles por rol en el software clínico', taskRisk: 'Accesos no autorizados a datos de salud',
    recNo: 'Cree un usuario por persona en el software clínico (nada de claves compartidas) y limite a recepción a agenda y cobros.',
    recPartial: 'Revise los perfiles: elimine usuarios de ex trabajadores y quite a recepción el acceso a diagnósticos y anamnesis.' },
  { id: 'q7', area: 'Seguridad', article: 'Art. 14 quinquies', critical: false, impact: 2, text: '¿Usan doble factor de autenticación en el software clínico y en el correo?',
    taskControl: 'Activar MFA en software clínico y correo institucional', taskRisk: 'Robo de credenciales por phishing',
    recNo: 'Active el doble factor en el software clínico y en el correo. Es gratis en la mayoría de los servicios y evita la mayoría de los robos de cuenta.',
    recPartial: 'Extienda el doble factor a todos los usuarios, incluidos dentistas que atienden part-time.' },
  { id: 'q8', area: 'Seguridad', article: 'Art. 14 quinquies', critical: false, impact: 2, text: '¿Los respaldos de radiografías y fichas están cifrados y se prueba su restauración?',
    taskControl: 'Cifrar respaldos y documentar una prueba de restauración trimestral', taskRisk: 'Pérdida de imágenes diagnósticas ante ransomware',
    recNo: 'Configure respaldos automáticos cifrados de radiografías y fichas, con una copia fuera de la clínica, y pruebe restaurarlos.',
    recPartial: 'Programe una prueba de restauración cada tres meses y guarde el resultado como evidencia.' },
  { id: 'q9', area: 'Incidentes', article: 'Art. 14 sexies', critical: true, impact: 1, text: '¿Tienen un protocolo para notificar vulneraciones de seguridad a la Agencia y a los pacientes afectados?',
    taskControl: 'Aprobar protocolo de respuesta a incidentes y designar responsables', taskRisk: 'Notificación tardía de una vulneración con datos de salud',
    recNo: 'Apruebe el protocolo de vulneraciones (borrador en Documentos) y deje claro a quién avisar. Con datos de salud hay que notificar a la Agencia y a los pacientes.',
    recPartial: 'Haga un simulacro con el equipo: un correo enviado al paciente equivocado o un notebook perdido.' },
  { id: 'q10', area: 'Proveedores', article: 'Art. 15 bis', critical: false, impact: 2, text: '¿Hay contrato con cláusulas de protección de datos con el laboratorio dental, el software clínico y el centro radiológico?',
    taskControl: 'Firmar anexo de encargo de tratamiento con cada proveedor', taskRisk: 'Terceros tratan datos de pacientes sin instrucciones ni deber de seguridad',
    recNo: 'Firme el anexo de encargo con laboratorio, software clínico, centro radiológico y mensajería. Empiece por quienes ven datos de salud.',
    recPartial: 'Complete los contratos pendientes; revise sobre todo laboratorio y agencia de marketing.' },
  { id: 'q11', area: 'Transferencias', article: 'Título V', critical: false, impact: 3, text: '¿Saben si algún proveedor almacena datos de pacientes fuera de Chile?',
    taskControl: 'Identificar ubicación de servidores de cada proveedor y su garantía de transferencia', taskRisk: 'Transferencia internacional sin garantías adecuadas',
    recNo: 'Pregunte por escrito a cada proveedor dónde están sus servidores. Si es fuera de Chile, pida la garantía de transferencia.',
    recPartial: 'Registre la respuesta de cada proveedor en el módulo Proveedores.' },
  { id: 'q12', area: 'Conservación', article: 'Art. 3', critical: false, impact: 3, text: '¿Tienen plazos de conservación definidos (ficha clínica 15 años, grabaciones de cámaras, fotos de marketing)?',
    taskControl: 'Definir tabla de plazos de conservación y rutina de eliminación', taskRisk: 'Datos guardados más tiempo del necesario',
    recNo: 'Defina una tabla de plazos: ficha clínica 15 años, cámaras 30 días, contacto web 1 año, fotos de marketing hasta que el paciente retire el permiso.',
    recPartial: 'Agregue una rutina de eliminación periódica y registre cada borrado.' },
  { id: 'q13', area: 'Riesgo', article: 'Art. 15 ter', critical: false, impact: 2, text: '¿Han evaluado el impacto de los tratamientos de mayor riesgo (datos de salud a gran escala, biometría, IA)?',
    taskControl: 'Realizar evaluación de impacto de la ficha clínica e imágenes', taskRisk: 'Riesgos altos sin análisis ni mitigación documentada',
    recNo: 'Haga la evaluación de impacto de la ficha clínica e imágenes, que son el tratamiento de mayor riesgo de una clínica dental.',
    recPartial: 'Termine las evaluaciones en curso y anote las medidas de mitigación aprobadas.' },
  { id: 'q14', area: 'Personas', article: 'Art. 14 bis', critical: false, impact: 2, text: '¿El personal de recepción y clínico recibió capacitación sobre privacidad y deber de secreto este año?',
    taskControl: 'Capacitar al equipo y registrar asistencia como evidencia', taskRisk: 'Filtraciones por error humano en recepción o WhatsApp',
    recNo: 'Haga una capacitación corta (1 hora) para recepción y clínicos: secreto, WhatsApp, correos, pantallas. Guarde la lista de asistencia.',
    recPartial: 'Incluya al personal nuevo y a los dentistas externos, y repítala cada año.' },
  { id: 'q15', area: 'Menores', article: 'Art. 16 quáter', critical: false, impact: 2, text: '¿Tienen reglas para pacientes menores de edad (odontopediatría, ortodoncia), incluida la autorización de padres o tutores?',
    taskControl: 'Definir procedimiento para datos de niños, niñas y adolescentes', taskRisk: 'Tratamiento de datos de menores sin resguardos reforzados',
    recNo: 'Defina cómo se autoriza el tratamiento de datos de menores (odontopediatría, ortodoncia) y quién puede pedir información sobre ellos.',
    recPartial: 'Revise que las fotos de ortodoncia de menores nunca se publiquen sin autorización de padres o tutores.' },
  { id: 'q16', area: 'Diseño', article: 'Art. 14 quáter', critical: false, impact: 3, text: '¿Revisan la privacidad antes de incorporar un sistema nuevo (huella para asistencia, IA, nueva app de agenda)?',
    taskControl: 'Usar checklist de privacidad desde el diseño en cada proyecto nuevo', taskRisk: 'Nuevos sistemas que tratan datos sin controles',
    recNo: 'Antes de contratar un sistema nuevo (huella, IA, nueva agenda), revise qué datos usa con el checklist de privacidad desde el diseño.',
    recPartial: 'Haga obligatorio el checklist para cualquier sistema o campaña nueva.' },
];

export const TEMPLATES = [
  { id: 'politica', title: 'Política de privacidad para pacientes', reference: 'Art. 14 ter · sitio web y recepción', body: `POLÍTICA DE PRIVACIDAD Y PROTECCIÓN DE DATOS PERSONALES
{{clinica.nombre}} · RUT {{clinica.rut}}
{{clinica.direccion}}
Versión del {{fecha}}

1. Quién es responsable de sus datos
{{clinica.nombre}} es responsable del tratamiento de los datos personales de sus pacientes. Puede contactarnos en {{clinica.email}}. La persona encargada de privacidad es {{clinica.responsable}}.

2. Qué datos tratamos
- Identificación y contacto: nombre, RUT, fecha de nacimiento, teléfono, correo y dirección.
- Datos de salud: anamnesis, odontograma, diagnósticos, plan de tratamiento, radiografías, fotografías clínicas y escaneos intraorales. Estos datos son sensibles y reciben protección reforzada.
- Datos de pago y previsión: Fonasa o Isapre, presupuestos, bonos y boletas.

3. Para qué los usamos y con qué base legal
- Atenderle, diagnosticar y dar continuidad a su tratamiento, conforme a la Ley 20.584 sobre derechos y deberes de los pacientes.
- Agendar y recordarle sus citas.
- Cobrar y emitir documentos tributarios, por obligación legal.
- Publicar fotografías clínicas solo si usted da su consentimiento expreso y separado, que puede retirar en cualquier momento.

4. Con quién los compartimos
Solo con proveedores que nos prestan servicios (software clínico, laboratorio dental, centro radiológico, mensajería y contabilidad), bajo contrato y con instrucciones de seguridad. No vendemos sus datos.

5. Cuánto tiempo los guardamos
La ficha clínica se conserva al menos 15 años desde la última atención, según la normativa sanitaria. Otros datos se conservan solo el tiempo necesario para su finalidad.

6. Sus derechos
Usted puede solicitar acceso, rectificación, supresión, oposición, portabilidad y bloqueo de sus datos escribiendo a {{clinica.email}}, en nuestro formulario web o en recepción. Responderemos dentro de 30 días corridos. Si no queda conforme, puede recurrir a la Agencia de Protección de Datos Personales.

7. Seguridad
Aplicamos medidas técnicas y organizativas como usuarios individuales, permisos por rol, respaldos cifrados y capacitación del personal.` },
  { id: 'aviso', title: 'Aviso breve para recepción', reference: 'Art. 14 ter · cartel o pantalla', body: `SUS DATOS ESTÁN PROTEGIDOS

En {{clinica.nombre}} usamos sus datos personales y de salud solo para atenderle, agendar sus citas y cumplir obligaciones legales.

No publicamos fotos de su tratamiento sin su autorización por escrito.

Puede pedir acceso, corrección o eliminación de sus datos en recepción o en {{clinica.email}}. Respondemos dentro de 30 días corridos.

Política completa: solicítela en recepción o en nuestro sitio web.` },
  { id: 'fotos', title: 'Consentimiento para fotografías clínicas', reference: 'Art. 12 · Art. 16 · marketing', body: `CONSENTIMIENTO PARA EL USO DE FOTOGRAFÍAS CLÍNICAS
{{clinica.nombre}}

Yo, ______________________, RUT ______________, autorizo a {{clinica.nombre}} a usar fotografías de mi tratamiento dental para los fines que marco a continuación:

[ ] Presentaciones académicas o docentes, sin mostrar mi rostro completo
[ ] Publicación en redes sociales y sitio web de la clínica
[ ] Publicación mostrando mi rostro completo

Declaro que:
- Fui informado(a) de que las fotografías son datos de salud y por lo tanto datos sensibles.
- Mi decisión no afecta la atención que recibo.
- Puedo retirar este consentimiento en cualquier momento escribiendo a {{clinica.email}}. Al retirarlo, la clínica eliminará las publicaciones bajo su control.

Plazo de uso: ____ meses desde la firma.

Firma del paciente o representante legal: ______________   Fecha: ________` },
  { id: 'encargo', title: 'Anexo de encargo de tratamiento', reference: 'Art. 15 bis · laboratorio, software, radiología', body: `ANEXO DE ENCARGO DE TRATAMIENTO DE DATOS PERSONALES

Entre {{clinica.nombre}}, RUT {{clinica.rut}} ("el Responsable"), y ______________________, RUT ______________ ("el Encargado").

1. Objeto. El Encargado tratará datos personales de pacientes del Responsable únicamente para prestar el servicio de ______________________ y siguiendo sus instrucciones documentadas.

2. Datos. Identificación del paciente y datos de salud necesarios para el servicio. Son datos sensibles.

3. Confidencialidad. El Encargado y su personal guardarán secreto sobre los datos, incluso después de terminado el contrato.

4. Seguridad. El Encargado aplicará medidas técnicas y organizativas adecuadas, como control de acceso, cifrado y respaldos.

5. Subencargados. El Encargado no subcontratará el tratamiento sin autorización previa y escrita del Responsable.

6. Vulneraciones. El Encargado avisará al Responsable de cualquier vulneración de seguridad dentro de 24 horas desde que tome conocimiento.

7. Derechos de los titulares. El Encargado colaborará para responder solicitudes de los pacientes dentro de los plazos legales.

8. Transferencias. Si los datos se alojan fuera de Chile, el Encargado informará el país y la garantía aplicable.

9. Término. Al finalizar el servicio, el Encargado devolverá o eliminará los datos, según instruya el Responsable, y certificará su eliminación.

Firma Responsable: ______________   Firma Encargado: ______________` },
  { id: 'incidentes', title: 'Protocolo de vulneraciones de seguridad', reference: 'Art. 14 sexies', body: `PROTOCOLO DE RESPUESTA A VULNERACIONES DE SEGURIDAD
{{clinica.nombre}} · Responsable: {{clinica.responsable}}

1. Detección. Cualquier integrante del equipo que detecte una posible vulneración (correo enviado por error, equipo perdido, acceso extraño al software clínico) avisa de inmediato a {{clinica.responsable}} y la registra en PRIVACY 21719.

2. Contención (primeras horas). Cambiar contraseñas, cerrar sesiones activas, aislar el equipo afectado y pedir apoyo al proveedor de software.

3. Evaluación. Determinar qué datos se vieron afectados, cuántos pacientes y si hay datos de salud.

4. Notificación a la Agencia. Si existe riesgo para los derechos de los pacientes, notificar a la Agencia de Protección de Datos Personales sin dilaciones indebidas.

5. Comunicación a pacientes. Si se vieron afectados datos de salud u otros datos sensibles, comunicar a los pacientes en lenguaje claro qué pasó, qué datos y qué pueden hacer.

6. Registro. Documentar el incidente con fechas, medidas y evidencia, aunque no haya sido necesario notificar.

7. Revisión. Dentro de 30 días, revisar la causa y actualizar controles y capacitación.` },
  { id: 'derechos', title: 'Procedimiento de solicitudes de pacientes', reference: 'Art. 4–11 · 30 días corridos', body: `PROCEDIMIENTO DE SOLICITUDES DE PACIENTES
{{clinica.nombre}}

Canales: {{clinica.email}}, formulario web y recepción.

1. Recepción. Registrar la solicitud el mismo día en PRIVACY 21719. El sistema asigna folio y calcula el vencimiento a 30 días corridos.

2. Verificación de identidad. Confirmar que quien solicita es el paciente o su representante legal antes de entregar información.

3. Análisis. {{clinica.responsable}} revisa la solicitud. Considerar que la ficha clínica debe conservarse al menos 15 años, por lo que una supresión puede ser parcial.

4. Respuesta. Responder por escrito antes del vencimiento. Si se necesita más tiempo, informar la prórroga y su motivo antes de que venza el primer plazo.

5. Cierre. Registrar la respuesta enviada y cerrar la solicitud.` },
];
