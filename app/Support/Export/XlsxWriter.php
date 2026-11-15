<?php

namespace App\Support\Export;

use RuntimeException;

final class XlsxWriter
{
    /** @var array<int, array<int, array{value: mixed, bold: bool}>> */
    private array $rows = [];

    public function __construct(private readonly string $sheetName = 'Laporan') {}

    /**
     * @param  array<int, mixed>  $cells
     */
    public function addRow(array $cells, bool $bold = false): void
    {
        $this->rows[] = array_map(
            fn (mixed $value): array => ['value' => $value, 'bold' => $bold],
            $cells,
        );
    }

    public function addBlankRow(): void
    {
        $this->rows[] = [];
    }

    public function save(string $path): void
    {
        $zip = new ZipWriter;
        $zip->add('[Content_Types].xml', $this->contentTypes());
        $zip->add('_rels/.rels', $this->rootRelations());
        $zip->add('xl/workbook.xml', $this->workbook());
        $zip->add('xl/_rels/workbook.xml.rels', $this->workbookRelations());
        $zip->add('xl/styles.xml', $this->styles());
        $zip->add('xl/worksheets/sheet1.xml', $this->sheet());

        try {
            $zip->save($path);
        } catch (RuntimeException $exception) {
            throw $exception;
        }
    }

    private function contentTypes(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            .'<Default Extension="xml" ContentType="application/xml"/>'
            .'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            .'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            .'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            .'</Types>';
    }

    private function rootRelations(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            .'</Relationships>';
    }

    private function workbook(): string
    {
        $sheetName = htmlspecialchars(mb_substr($this->sheetName, 0, 31), ENT_XML1);

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            .'<sheets><sheet name="'.$sheetName.'" sheetId="1" r:id="rId1"/></sheets>'
            .'</workbook>';
    }

    private function workbookRelations(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            .'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            .'</Relationships>';
    }

    private function styles(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
            .'<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
            .'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            .'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            .'<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            .'<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
            .'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
            .'</styleSheet>';
    }

    private function sheet(): string
    {
        $columns = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="8" width="18" customWidth="1"/></cols>'
            .'<sheetData>';

        foreach ($this->rows as $rowIndex => $cells) {
            $number = $rowIndex + 1;
            $columns .= '<row r="'.$number.'">';

            foreach ($cells as $cellIndex => $cell) {
                $ref = $this->columnLetter($cellIndex + 1).$number;
                $style = $cell['bold'] ? ' s="1"' : '';
                $value = $cell['value'];

                if (is_int($value) || is_float($value)) {
                    $columns .= '<c r="'.$ref.'"'.$style.'><v>'.$value.'</v></c>';
                } else {
                    $text = htmlspecialchars((string) $value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
                    $columns .= '<c r="'.$ref.'" t="inlineStr"'.$style.'><is><t xml:space="preserve">'.$text.'</t></is></c>';
                }
            }

            $columns .= '</row>';
        }

        return $columns.'</sheetData></worksheet>';
    }

    private function columnLetter(int $index): string
    {
        $letter = '';

        while ($index > 0) {
            $index--;
            $letter = chr(65 + ($index % 26)).$letter;
            $index = intdiv($index, 26);
        }

        return $letter;
    }
}
