from flask import Flask, request, send_file
from flask_cors import CORS
import pikepdf
import io
import zipfile
import pytesseract
import os
from pdf2image import convert_from_bytes
from pdf2docx import Converter
import tempfile
# Dynamic pathing for Windows (local) vs Linux (live server)
if os.name == 'nt': 
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    POPPLER_PATH = r'C:\poppler-25.12.0\Library\bin'
else: 
    POPPLER_PATH = None



app = Flask(__name__)
# This allows your local HTML file to talk to this server
CORS(app) 

@app.route('/unlock', methods=['POST'])
def unlock_pdf():
    # 1. Check if the frontend sent the right data
    if 'file' not in request.files or 'password' not in request.form:
        return "Missing file or password", 400

    file = request.files['file']
    password = request.form['password']

    try:
        # 2. Open the PDF using the provided password
        pdf = pikepdf.Pdf.open(file.stream, password=password)
        
        # 3. Save the unlocked PDF into your computer's temporary memory (RAM)
        out_pdf = io.BytesIO()
        pdf.save(out_pdf)
        out_pdf.seek(0)
        
        # 4. Send the unlocked file back to the browser
        return send_file(out_pdf, mimetype='application/pdf', as_attachment=True, download_name='Unlocked.pdf')
        
    except pikepdf.PasswordError:
        return "Incorrect Password!", 403
    except Exception as e:
        return f"An error occurred: {str(e)}", 500

@app.route('/protect', methods=['POST'])
def protect_pdf():
    # 1. Check if the frontend sent the file and password
    if 'file' not in request.files or 'password' not in request.form:
        return "Missing file or password", 400

    file = request.files['file']
    password = request.form['password']

    try:
        # 2. Open the normal PDF
        pdf = pikepdf.Pdf.open(file.stream)
        
        # 3. Create the encryption (locks it with the password)
        # We use user/owner passwords and restrict extraction by default
        encryption = pikepdf.Encryption(user=password, owner=password, allow=pikepdf.Permissions(extract=False))
        
        # 4. Save the locked file to memory
        out_pdf = io.BytesIO()
        pdf.save(out_pdf, encryption=encryption)
        out_pdf.seek(0)
        
        # 5. Send it back to the browser
        return send_file(out_pdf, mimetype='application/pdf', as_attachment=True, download_name='Protected.pdf')
        
    except Exception as e:
        return f"An error occurred: {str(e)}", 500

@app.route('/compress', methods=['POST'])
def compress_pdf():
    if 'file' not in request.files:
        return "No file uploaded", 400

    file = request.files['file']

    try:
        # 1. Calculate the Original File Size in bytes
        file.seek(0, 2) # Move to the end of the file
        original_size = file.tell() # Get the byte count
        file.seek(0) # Move back to the start so pikepdf can read it!

        # 2. Open the PDF using pikepdf
        pdf = pikepdf.Pdf.open(file.stream)
        
        # 3. Save with aggressive optimization settings
        out_pdf = io.BytesIO()
        pdf.save(
            out_pdf, 
            linearize=True, 
            object_stream_mode=pikepdf.ObjectStreamMode.generate
        )
        
        # 4. Calculate the New Compressed Size
        compressed_size = out_pdf.tell()
        out_pdf.seek(0)
        
        # 5. Create the response and attach our custom analytics headers!
        response = send_file(
            out_pdf, 
            mimetype='application/pdf', 
            as_attachment=True, 
            download_name='Compressed_Document.pdf'
        )
        
        response.headers['X-Original-Size'] = str(original_size)
        response.headers['X-Compressed-Size'] = str(compressed_size)
        # CRITICAL: We must tell the browser it is allowed to read these custom headers
        response.headers['Access-Control-Expose-Headers'] = 'X-Original-Size, X-Compressed-Size'
        
        return response
        
    except Exception as e:
        return f"Compression failed: {str(e)}", 500


@app.route('/ocr', methods=['POST'])
def ocr_pdf():
    if 'file' not in request.files:
        return "No file uploaded", 400

    file = request.files['file']

    try:
        # 1. Convert PDF pages to images
        images = convert_from_bytes(file.read(), poppler_path=POPPLER_PATH)
        
        # 2. Run OCR on every page
        full_text = ""
        for i, image in enumerate(images):
            page_text = pytesseract.image_to_string(image)
            full_text += f"--- Page {i+1} ---\n{page_text}\n\n"
        
        # 3. Send the extracted text back as a .txt file
        text_io = io.BytesIO(full_text.encode('utf-8'))
        return send_file(
            text_io, 
            mimetype='text/plain', 
            as_attachment=True, 
            download_name='Extracted_Text.txt'
        )
        
    except Exception as e:
        return f"OCR failed: {str(e)}", 500

@app.route('/pdf-to-img', methods=['POST'])
def pdf_to_img():
    if 'file' not in request.files:
        return "No file uploaded", 400

    file = request.files['file']
    # Grab the format choice from the frontend (default to jpeg if missing)
    img_format = request.form.get('format', 'jpeg').lower()
    
    # Map the web format to the exact term the Python Image Library (PIL) needs
    pil_format = 'PNG' if img_format == 'png' else 'JPEG'
    file_extension = 'png' if img_format == 'png' else 'jpg'
    mime_type = f'image/{img_format}'

    try:
        images = convert_from_bytes(file.read(), poppler_path=POPPLER_PATH)
        
        # If it's just a 1-page PDF, send back a single image
        if len(images) == 1:
            img_io = io.BytesIO()
            images[0].save(img_io, pil_format)
            img_io.seek(0)
            return send_file(img_io, mimetype=mime_type, as_attachment=True, download_name=f'Page_1.{file_extension}')
        
        # If multiple pages, package all images into a ZIP file
        zip_io = io.BytesIO()
        with zipfile.ZipFile(zip_io, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for i, image in enumerate(images):
                img_io = io.BytesIO()
                image.save(img_io, pil_format)
                zip_file.writestr(f'Page_{i+1}.{file_extension}', img_io.getvalue())
        
        zip_io.seek(0)
        return send_file(zip_io, mimetype='application/zip', as_attachment=True, download_name='Converted_Images.zip')

    except Exception as e:
        return f"PDF to Image failed: {str(e)}", 500

@app.route('/pdf-to-word', methods=['POST'])
def pdf_to_word():
    if 'file' not in request.files:
        return "No file uploaded", 400

    file = request.files['file']

    try:
        # 1. Create secure, temporary files that will be deleted immediately after
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_pdf:
            file.save(temp_pdf.name)
            temp_pdf_path = temp_pdf.name
            
        temp_docx_path = temp_pdf_path.replace('.pdf', '.docx')

        # 2. Convert the PDF to Word
        cv = Converter(temp_pdf_path)
        cv.convert(temp_docx_path)
        cv.close()

        # 3. Read the generated Word doc into memory
        with open(temp_docx_path, 'rb') as docx_file:
            out_docx = io.BytesIO(docx_file.read())
        
        # 4. Clean up (Privacy first! Delete the temporary files from the server)
        os.remove(temp_pdf_path)
        os.remove(temp_docx_path)

        out_docx.seek(0) # Prepare file for sending
        
        return send_file(
            out_docx, 
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
            as_attachment=True, 
            download_name='Converted_Document.docx'
        )

    except Exception as e:
        return f"PDF to Word failed: {str(e)}", 500

if __name__ == '__main__':
    # Starts the server
    app.run(debug=True, port=5000)